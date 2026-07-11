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
// - baseVersions: id → updatedAt останньої УЗГОДЖЕНОЇ з сервером версії
//   (успішно запушеної або застосованої з хмари). Потрібна, щоб відрізнити
//   справжній конфлікт (обидва боки змінились НЕЗАЛЕЖНО) від «луни» власного
//   пуша: pull повертає щойно запушену нами версію (serverUpdatedAt новіший за
//   маркер), і якщо юзер тим часом ще раз відредагував айтем, без цієї мапи
//   пара «нова локальна vs стара своя ж» виглядала б як конфлікт двох пристроїв.
const META_BASE_VERSIONS = 'sync.baseVersions';
// Для відображення юзеру; також читається TombstoneVacuumService (Step 09,
// задача 6) — щоб знати, які tombstones точно вже долетіли до хмари.
export const META_LAST_SYNC_AT = 'sync.lastSyncAt';

const PUSH_BATCH = 200;
const MAX_PUSH_CONFLICT_ROUNDS = 3;
// Автосинк (ARCHITECTURE §6): debounce після мутацій, троттл на фокус вкладки.
const MUTATION_DEBOUNCE_MS = 15_000;
const FOCUS_SYNC_THROTTLE_MS = 5 * 60_000;

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
  /** Конфлікти, відкладені неінтерактивним (авто) синком — бейдж на індикаторі. */
  readonly pendingConflicts = signal(0);

  private mutationDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastFocusSyncAt = 0;

  constructor() {
    void this.meta.get<string>(META_LAST_SYNC_AT).then((value) => {
      if (value) {
        this.lastSyncAt.set(value);
      }
    });

    // Автосинк: при старті апки (якщо вже залогінений) і після логіну.
    // Неінтерактивний і тихий: конфлікти йдуть у бейдж, помилки (офлайн тощо)
    // не турбують юзера снекбарами.
    let previousLoggedIn = false;
    effect(() => {
      const loggedIn = this.auth.isLoggedIn();
      if (loggedIn && !previousLoggedIn) {
        void this.autoSync();
      }
      previousLoggedIn = loggedIn;
    });

    // Автосинк по діях (ARCHITECTURE §6): debounce ~15с після серії мутацій
    // ItemsRepository, щоб не синкати на кожен символ нотатки окремо.
    let previousMutationTick = this.repo.mutationTick();
    effect(() => {
      const tick = this.repo.mutationTick();
      if (tick === previousMutationTick) {
        return;
      }
      previousMutationTick = tick;
      if (this.mutationDebounceTimer) {
        clearTimeout(this.mutationDebounceTimer);
      }
      this.mutationDebounceTimer = setTimeout(() => {
        this.mutationDebounceTimer = null;
        void this.autoSync();
      }, MUTATION_DEBOUNCE_MS);
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => void this.autoSync());
      window.addEventListener('focus', () => {
        const now = Date.now();
        if (now - this.lastFocusSyncAt < FOCUS_SYNC_THROTTLE_MS) {
          return;
        }
        this.lastFocusSyncAt = now;
        void this.autoSync();
      });
    }
  }

  /** Автоматичний тригер (мутація/online/фокус/старт): тихий, неінтерактивний. */
  private async autoSync(): Promise<void> {
    await this.sync({ silent: true, interactive: false }).catch(() => undefined);
  }

  /**
   * Повний цикл синку (ARCHITECTURE §6): pull → класифікація → тихі
   * застосування/пуші → merge-конфлікти через UI → push. Повертає підсумок
   * або null, якщо синк неможливий (не залогінений / вже йде).
   *
   * `interactive` (дефолт true): чи відкривати merge-діалог на знайдених
   * конфліктах. Автоматичні тригери (мутація/online/фокус/старт) кличуть з
   * `interactive: false` — конфлікти НЕ рухають маркери синку (лишаються
   * видимі при наступному pull) і показуються бейджем (`pendingConflicts`)
   * замість вискакуючого діалогу. Клік по індикатору в хедері — звичайний
   * інтерактивний синк, який ту саму пару знову побачить як конфлікт і
   * відкриє діалог.
   */
  async sync(options: { silent?: boolean; interactive?: boolean } = {}): Promise<SyncSummary | null> {
    if (!this.auth.isLoggedIn() || this.state() !== 'idle') {
      return null;
    }
    const interactive = options.interactive ?? true;
    this.state.set('syncing');
    this.lastSummary.set(null);

    try {
      const summary = await this.runSync(interactive);
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

  private async runSync(interactive: boolean): Promise<SyncSummary> {
    const since = await this.meta.get<string>(META_LAST_SERVER_TIME);
    const lastPushAt = (await this.meta.get<string>(META_LAST_PUSH_AT)) ?? '';
    const baseVersions =
      (await this.meta.get<Record<string, string>>(META_BASE_VERSIONS)) ?? {};

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
      // Ехо-фільтр (див. META_BASE_VERSIONS): якщо один бік — це версія, яку ми
      // вже узгодили з сервером, то реально змінився лише інший бік. Це НЕ
      // конфлікт — беремо змінений бік без merge і без діалогу.
      const agreed = baseVersions[pair.local.id];
      if (agreed && pair.remote.updatedAt === agreed && pair.local.updatedAt !== agreed) {
        toPush.push(pair.local);
        continue;
      }
      if (agreed && pair.local.updatedAt === agreed && pair.remote.updatedAt !== agreed) {
        toApply.push(pair.remote);
        continue;
      }

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
    // Неінтерактивний (авто) синк НЕ відкриває діалог: усі конфлікти лишаються
    // невирішеними (як skip — маркери синку нижче не зрушаться) і йдуть у
    // pendingConflicts бейджем. Наступний ІНТЕРАКТИВНИЙ синк (клік по
    // індикатору) знову побачить ту саму пару (маркери не рухались) і покаже
    // її в діалозі.
    let skipped = 0;
    let remainingConflicts = 0;
    if (conflictQueue.length > 0) {
      if (interactive) {
        const resolutions = await this.openMergeDialog(conflictQueue);
        for (const resolution of resolutions) {
          if (resolution.kind === 'skip') {
            skipped += 1;
            remainingConflicts += 1;
          } else {
            toApply.push(resolution.item);
            toPush.push(resolution.item);
          }
        }
      } else {
        skipped += conflictQueue.length;
        remainingConflicts = conflictQueue.length;
      }
    }
    this.pendingConflicts.set(remainingConflicts);

    // --- 5. Застосувати локально ---
    for (const item of toApply) {
      await this.repo.applyFromSync(item);
      baseVersions[item.id] = item.updatedAt; // застосоване з хмари = узгоджене
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
          if (response.saved.includes(item.id)) {
            baseVersions[item.id] = item.updatedAt; // прийняте сервером = узгоджене
            if (item.updatedAt > maxPushedUpdatedAt) {
              maxPushedUpdatedAt = item.updatedAt;
            }
          }
        }
        raceConflicts.push(...response.conflicts);
      }
      if (raceConflicts.length === 0) {
        // Успішний пуш без гонок: усе, що було в pending, уже прийняте сервером —
        // ІНАКШЕ (баг, знайдений при написанні step-09 тестів) pending лишався б
        // тим самим непорожнім масивом і нижче помилково рахувався б як
        // "пропущено", назавжди блокуючи lastServerTime/lastPushAt від
        // просування — кожен наступний синк перетягував би ВСЮ історію заново.
        pending = [];
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
          baseVersions[serverItem.id] = serverItem.updatedAt;
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
    // baseVersions зберігаємо ЗАВЖДИ: мапа містить лише реально узгоджені
    // версії (пропущені конфлікти її не чіпали). lastServerTime/lastPushAt —
    // лише коли нічого не пропущено: інакше наступний синк знову побачить
    // обидва боки конфлікту і поверне його юзеру.
    await this.meta.set(META_BASE_VERSIONS, baseVersions);
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
