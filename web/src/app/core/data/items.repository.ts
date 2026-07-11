import { Injectable, computed, inject } from '@angular/core';
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
    return item;
  }

  async update(id: string, patch: MediaItemPatch): Promise<void> {
    const safePatch = { ...(patch as Partial<MediaItem>) };
    delete safePatch.id;
    delete safePatch.createdAt;
    delete safePatch.updatedAt;
    await this.db.items.update(id, { ...safePatch, updatedAt: new Date().toISOString() });
  }

  async softDelete(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.items.update(id, { deletedAt: now, updatedAt: now });
  }

  async restore(id: string): Promise<void> {
    await this.db.items.update(id, { deletedAt: null, updatedAt: new Date().toISOString() });
  }

  /** Айтеми (включно з tombstones), змінені після `iso` — для синку. */
  changedSince(iso: string): Promise<MediaItem[]> {
    return this.db.items.where('updatedAt').above(iso).toArray();
  }
}
