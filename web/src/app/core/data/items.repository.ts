import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { liveQuery } from 'dexie';
import { from } from 'rxjs';

import { AppDb } from '../db/app-db';
import type { MediaItem, MediaStatus } from '../models/media-item.model';

export type NewMediaItemInput = Pick<MediaItem, 'kind' | 'status' | 'title'> &
  Partial<Omit<MediaItem, 'id' | 'kind' | 'status' | 'title' | 'createdAt' | 'updatedAt' | 'deletedAt'>>;

export type MediaItemPatch = Partial<Omit<MediaItem, 'id' | 'createdAt' | 'updatedAt'>>;

const EMPTY_ITEMS: MediaItem[] = [];
const ZERO_COUNTS: Record<MediaStatus, number> = { want: 0, watching: 0, watched: 0, dropped: 0 };

@Injectable({ providedIn: 'root' })
export class ItemsRepository {
  private readonly db = inject(AppDb);

  /** Всі НЕвидалені айтеми, реактивно (Dexie liveQuery → signal). */
  readonly items = toSignal(
    from(liveQuery(() => this.db.items.filter((item) => !item.deletedAt).toArray())),
    { initialValue: EMPTY_ITEMS },
  );

  // Лічильник локальних мутацій (ARCHITECTURE §6 автосинк): бампається ТІЛЬКИ
  // з add/update/softDelete/restore — НЕ з applyFromSync, інакше застосування
  // серверних змін саме собою тригерило б новий синк по колу.
  private readonly mutationSeq = signal(0);
  readonly mutationTick = this.mutationSeq.asReadonly();

  readonly counts = computed<Record<MediaStatus, number>>(() => {
    const counts = { ...ZERO_COUNTS };
    for (const item of this.items()) {
      counts[item.status]++;
    }
    return counts;
  });

  getById(id: string): Promise<MediaItem | undefined> {
    return this.db.items.get(id);
  }

  async add(input: NewMediaItemInput): Promise<MediaItem> {
    const now = new Date().toISOString();
    const item: MediaItem = {
      links: [],
      ...input,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    await this.db.items.add(item);
    this.mutationSeq.update((n) => n + 1);
    return item;
  }

  async update(id: string, patch: MediaItemPatch): Promise<void> {
    const safePatch = { ...(patch as Partial<MediaItem>) };
    delete safePatch.id;
    delete safePatch.createdAt;
    delete safePatch.updatedAt;
    await this.db.items.update(id, { ...safePatch, updatedAt: new Date().toISOString() });
    this.mutationSeq.update((n) => n + 1);
  }

  /** «Улюблене» (Step 11) — читає поточне значення і перемикає, той самий шлях, що update(). */
  async toggleFavorite(id: string): Promise<void> {
    const current = await this.db.items.get(id);
    if (!current) {
      return;
    }
    await this.update(id, { favorite: !current.favorite });
  }

  async softDelete(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.items.update(id, { deletedAt: now, updatedAt: now });
    this.mutationSeq.update((n) => n + 1);
  }

  async restore(id: string): Promise<void> {
    await this.db.items.update(id, { deletedAt: null, updatedAt: new Date().toISOString() });
    this.mutationSeq.update((n) => n + 1);
  }

  /** Айтеми (включно з tombstones), змінені після `iso` — для синку. */
  changedSince(iso: string): Promise<MediaItem[]> {
    return this.db.items.where('updatedAt').above(iso).toArray();
  }

  /** Усі айтеми, включно з tombstones — для експорту бекапу (Step 09, задача 1). */
  getAllForExport(): Promise<MediaItem[]> {
    return this.db.items.toArray();
  }

  /**
   * Імпорт з JSON-бекапу (Step 09, задача 1): пише айтеми ЯК Є (значення вже
   * пройшли mergeItems на виклику) і бампає лічильник мутацій — на відміну
   * від applyFromSync, це РЕАЛЬНА локальна зміна користувача, яку має підхопити
   * автосинк.
   */
  async importItems(items: MediaItem[]): Promise<void> {
    if (items.length === 0) {
      return;
    }
    await this.db.items.bulkPut(items);
    this.mutationSeq.update((n) => n + 1);
  }

  /**
   * ТІЛЬКИ для SyncService: записує айтем ЯК Є, не чіпаючи updatedAt —
   * версія з хмари/merge вже має власний коректний updatedAt, і бампнути його
   * означало б нескінченний пінг-понг між пристроями.
   */
  applyFromSync(item: MediaItem): Promise<string> {
    return this.db.items.put(item);
  }

  /** Усі tombstones (deletedAt проставлений) — для вакууму (Step 09, задача 6). */
  getTombstones(): Promise<MediaItem[]> {
    return this.db.items.filter((item) => !!item.deletedAt).toArray();
  }

  /**
   * Фізичне видалення (вакуум старих tombstones). НЕ бампає лічильник мутацій —
   * ці tombstones вже або синкнуті (сервер і так їх бачив), або синкати нема
   * з ким, тож серверу нічого повідомляти.
   */
  async hardDeleteMany(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await this.db.items.bulkDelete(ids);
  }
}
