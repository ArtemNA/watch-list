import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { ItemsRepository } from '../data/items.repository';
import { MetaRepository } from '../data/meta.repository';
import type { MediaItem } from '../models/media-item.model';
import { classifyChanges, mergeItems, type FieldConflict } from './merge';

// Ключі meta (IndexedDB):
// - lastServerTime: серверний маркер останнього повного pull (курсор для ?since).
//   Порівнюється ТІЛЬКИ з serverUpdatedAt, який ставить сервер, — клієнтські
//   годинники різних пристроїв тут не змішуються.
// - lastPushAt: максимальний updatedAt айтемів, які цей клієнт успішно
//   запушив/застосував; локальні зміни = updatedAt > lastPushAt.
const META_LAST_SERVER_TIME = 'sync.lastServerTime';
const META_LAST_PUSH_AT = 'sync.lastPushAt';
const META_LAST_SYNC_AT = 'sync.lastSyncAt'; // для відображення юзеру

const PUSH_BATCH = 200;
const MAX_PUSH_CONFLICT_ROUNDS = 3;

export type SyncState = 'idle' | 'syncing' | 'conflicts' | 'error';

export interface SyncConflict {
  local: MediaItem;
  remote: MediaItem;
  kind: 'fields' | 'deleted';
  /** Для kind='fields': айтем з уже злитими безконфліктними полями. */
  base?: MediaItem;
  fields?: FieldConflict[];
  deletedSide?: 'local' | 'remote';
}

export interface SyncSummary {
  pulled: number;
  pushed: number;
  conflicts: number;
  skipped: number;
}

interface PullResponse {
  items: MediaItem[];
  next: string | null;
  serverTime: string;
}

interface PushResponse {
  saved: string[];
  conflicts: MediaItem[];
}

@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly repo = inject(ItemsRepository);
  private readonly meta = inject(MetaRepository);
  private readonly dialog = inject(MatDialog);

  readonly state = signal<SyncState>('idle');
  readonly lastSyncAt = signal<string | null>(null);
  readonly lastSummary = signal<SyncSummary | null>(null);
  readonly isSyncing = computed(() => this.state() === 'syncing');

  constructor() {
    void this.meta.get<string>(META_LAST_SYNC_AT).then((value) => {
      if (value) {
        this.lastSyncAt.set(value);
      }
    });

    // Автосинк: при старті апки (якщо вже залогінений) і після логіну.
    // Тихий: помилки (офлайн тощо) не турбують юзера снекбарами.
    let previous = false;
    effect(() => {
      const loggedIn = this.auth.isLoggedIn();
      if (loggedIn && !previous) {
        void this.sync({ silent: true }).catch(() => undefined);
      }
      previous = loggedIn;
    });
  }

  /**
   * Повний цикл синку (ARCHITECTURE §6): pull → класифікація → тихі
   * застосування/пуші → merge-конфлікти через UI → push. Повертає підсумок
   * або null, якщо синк неможливий (не залогінений / вже йде).
   */
  async sync(options: { silent?: boolean } = {}): Promise<SyncSummary | null> {
    if (!this.auth.isLoggedIn() || this.state() !== 'idle') {
      return null;
    }
    this.state.set('syncing');
    this.lastSummary.set(null);

    try {
      const summary = await this.runSync();
      this.lastSummary.set(summary);
      this.state.set('idle');

      const now = new Date().toISOString();
      this.lastSyncAt.set(now);
      await this.meta.set(META_LAST_SYNC_AT, now);
      return summary;
    } catch (error) {
      this.state.set('error');
      if (!options.silent) {
        throw error;
      }
      return null;
    }
  }

  private async runSync(): Promise<SyncSummary> {
    const since = await this.meta.get<string>(META_LAST_SERVER_TIME);
    const lastPushAt = (await this.meta.get<string>(META_LAST_PUSH_AT)) ?? '';

    // --- 1. Pull (з пагінацією) ---
    const remoteById = new Map<string, MediaItem>();
    let cursor: string | undefined = since ?? undefined;
    let serverTime!: string; // присвоюється в кожній ітерації циклу до першого read
    for (;;) {
      const page = await firstValueFrom(
        this.http.get<PullResponse>('/api/sync/items', {
          params: cursor ? { since: cursor } : {},
        }),
      );
      for (const item of page.items) {
        remoteById.set(item.id, item);
      }
      serverTime = page.serverTime;
      if (!page.next) {
        break;
      }
      cursor = page.next;
    }
    const remoteChanged = [...remoteById.values()];

    // --- 2. Локальні зміни ---
    const localChanged = await this.repo.changedSince(lastPushAt);

    // --- 3. Класифікація і merge ---
    const { remoteOnly, localOnly, pairs } = classifyChanges(localChanged, remoteChanged);
    const now = new Date().toISOString();

    const toApply: MediaItem[] = [...remoteOnly];
    const toPush: MediaItem[] = [...localOnly];
    const conflictQueue: SyncConflict[] = [];

    for (const pair of pairs) {
      const outcome = mergeItems(pair.local, pair.remote, now);
      switch (outcome.kind) {
        case 'identical':
          break;
        case 'useLocal':
          toPush.push(pair.local);
          break;
        case 'useRemote':
          toApply.push(pair.remote);
          break;
        case 'merged':
          toApply.push(outcome.item);
          toPush.push(outcome.item);
          break;
        case 'conflict':
          conflictQueue.push({ ...pair, kind: 'fields', base: outcome.base, fields: outcome.fields });
          break;
        case 'deletedVsEdited':
          conflictQueue.push({ ...pair, kind: 'deleted', deletedSide: outcome.deletedSide });
          break;
      }
    }

    // --- 4. Конфлікти через UI ---
    let skipped = 0;
    if (conflictQueue.length > 0) {
      const resolutions = await this.openMergeDialog(conflictQueue);
      for (const resolution of resolutions) {
        if (resolution.kind === 'skip') {
          skipped += 1;
        } else {
          toApply.push(resolution.item);
          toPush.push(resolution.item);
        }
      }
    }

    // --- 5. Застосувати локально ---
    for (const item of toApply) {
      await this.repo.applyFromSync(item);
    }

    // --- 6. Push (батчами, з обробкою серверних конфліктів-гонок) ---
    let pushedCount = 0;
    let maxPushedUpdatedAt = lastPushAt;
    let pending = toPush;
    for (let round = 0; round < MAX_PUSH_CONFLICT_ROUNDS && pending.length > 0; round++) {
      const raceConflicts: MediaItem[] = [];
      for (let i = 0; i < pending.length; i += PUSH_BATCH) {
        const batch = pending.slice(i, i + PUSH_BATCH);
        const response = await firstValueFrom(
          this.http.post<PushResponse>('/api/sync/items', { items: batch }),
        );
        pushedCount += response.saved.length;
        for (const item of batch) {
          if (response.saved.includes(item.id) && item.updatedAt > maxPushedUpdatedAt) {
            maxPushedUpdatedAt = item.updatedAt;
          }
        }
        raceConflicts.push(...response.conflicts);
      }
      if (raceConflicts.length === 0) {
        break;
      }
      // Інший пристрій встиг запушити новішу версію між нашим pull і push:
      // зливаємо ще раз; справжні конфлікти тут відкладаємо на наступний синк
      // (щоб не відкривати діалог по колу), автозлиття — пушимо повторно.
      const retry: MediaItem[] = [];
      for (const serverItem of raceConflicts) {
        const ours = pending.find((item) => item.id === serverItem.id);
        if (!ours) {
          continue;
        }
        const outcome = mergeItems(ours, serverItem, new Date().toISOString());
        if (outcome.kind === 'merged') {
          await this.repo.applyFromSync(outcome.item);
          retry.push(outcome.item);
        } else if (outcome.kind === 'useLocal') {
          retry.push(ours);
        } else if (outcome.kind === 'useRemote' || outcome.kind === 'identical') {
          await this.repo.applyFromSync(serverItem);
        } else {
          skipped += 1;
        }
      }
      pending = retry;
    }
    if (pending.length > 0) {
      skipped += pending.length;
    }

    // --- 7. Маркери ---
    // Якщо щось пропущено — НЕ рухаємо lastServerTime/lastPushAt: наступний синк
    // знову побачить обидва боки конфлікту і поверне його юзеру.
    if (skipped === 0) {
      await this.meta.set(META_LAST_SERVER_TIME, serverTime);
      if (maxPushedUpdatedAt) {
        await this.meta.set(META_LAST_PUSH_AT, maxPushedUpdatedAt);
      }
    }

    return {
      pulled: toApply.length,
      pushed: pushedCount,
      conflicts: conflictQueue.length,
      skipped,
    };
  }

  /**
   * Відкриває merge-діалог і чекає рішень. Динамічний import — щоб SyncService
   * (core) не тягнув feature-компонент у свій чанк і не створював цикл залежностей.
   * disableClose: закрити хрестиком/фоном не можна — тільки рішення по кожному
   * конфлікту (skip рахується як рішення), щоб діалог не «зник» разом із чергою.
   */
  private async openMergeDialog(conflicts: SyncConflict[]): Promise<ConflictResolution[]> {
    const { MergeDialog } = await import('../../features/sync/merge-dialog/merge-dialog');
    const ref = this.dialog.open(MergeDialog, {
      data: { conflicts },
      width: 'min(560px, calc(100vw - 32px))',
      disableClose: true,
    });
    const result = await firstValueFrom(ref.afterClosed());
    // Якщо діалог якимось чином закрився без результату — трактуємо як skip усіх.
    return result ?? conflicts.map(() => ({ kind: 'skip' as const }));
  }
}

export type ConflictResolution = { kind: 'resolved'; item: MediaItem } | { kind: 'skip' };
