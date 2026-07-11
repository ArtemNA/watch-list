import { Injectable, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { liveQuery } from 'dexie';
import { from } from 'rxjs';

import { AppDb } from '../db/app-db';
import type { ListEntry, MediaList } from '../models/media-list.model';
import { entryKey } from './list-entry';

const EMPTY_LISTS: MediaList[] = [];

@Injectable({ providedIn: 'root' })
export class ListsRepository {
  private readonly db = inject(AppDb);

  /** Всі НЕвидалені списки, реактивно (як ItemsRepository.items). */
  readonly lists = toSignal(
    from(liveQuery(() => this.db.lists.filter((list) => !list.deletedAt).toArray())),
    { initialValue: EMPTY_LISTS },
  );

  // Той самий лічильник мутацій, що в ItemsRepository — SyncService дебаунсить
  // автосинк на нього (ARCHITECTURE §6). НЕ бампається з applyFromSync.
  private readonly mutationSeq = signal(0);
  readonly mutationTick = this.mutationSeq.asReadonly();

  getById(id: string): Promise<MediaList | undefined> {
    return this.db.lists.get(id);
  }

  async create(name: string, description?: string): Promise<MediaList> {
    const now = new Date().toISOString();
    const list: MediaList = {
      id: crypto.randomUUID(),
      name,
      ...(description ? { description } : {}),
      entries: [],
      createdAt: now,
      updatedAt: now,
    };
    await this.db.lists.add(list);
    this.mutationSeq.update((n) => n + 1);
    return list;
  }

  async rename(id: string, name: string): Promise<void> {
    await this.db.lists.update(id, { name, updatedAt: new Date().toISOString() });
    this.mutationSeq.update((n) => n + 1);
  }

  async updateDescription(id: string, description: string): Promise<void> {
    await this.db.lists.update(id, {
      description: description || undefined,
      updatedAt: new Date().toISOString(),
    });
    this.mutationSeq.update((n) => n + 1);
  }

  async softDelete(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.lists.update(id, { deletedAt: now, updatedAt: now });
    this.mutationSeq.update((n) => n + 1);
  }

  async restore(id: string): Promise<void> {
    await this.db.lists.update(id, { deletedAt: null, updatedAt: new Date().toISOString() });
    this.mutationSeq.update((n) => n + 1);
  }

  /** Списки (включно з tombstones), змінені після `iso` — для синку. */
  changedSince(iso: string): Promise<MediaList[]> {
    return this.db.lists.where('updatedAt').above(iso).toArray();
  }

  /**
   * Дедуп всередині списку по (tmdbId ?? id) — повторне додавання того самого
   * фільму в той самий список є no-op (Step 11, задача 3).
   */
  async addEntry(listId: string, entryData: Omit<ListEntry, 'addedAt'>): Promise<void> {
    const list = await this.db.lists.get(listId);
    if (!list) {
      return;
    }
    const key = entryKey(entryData);
    if (list.entries.some((existing) => entryKey(existing) === key)) {
      return;
    }
    const entry: ListEntry = { ...entryData, addedAt: new Date().toISOString() };
    await this.db.lists.update(listId, {
      entries: [...list.entries, entry],
      updatedAt: new Date().toISOString(),
    });
    this.mutationSeq.update((n) => n + 1);
  }

  /**
   * Перепідв'язує entry без tmdbId на щойно створений айтем бібліотеки (Step 11,
   * задача 6 "+ в бібліотеку"): для entries, доданих із бібліотеки, `id === itemId`
   * (див. list-entry.ts) — новий айтем отримує СВІЙ uuid від ItemsRepository.add,
   * тож без цього кроку резолв (по id, бо tmdbId нема) більше ніколи б не збігся.
   */
  async relinkEntry(listId: string, entryId: string, newItemId: string): Promise<void> {
    const list = await this.db.lists.get(listId);
    if (!list) {
      return;
    }
    const index = list.entries.findIndex((entry) => entry.id === entryId);
    if (index === -1) {
      return;
    }
    const entries = [...list.entries];
    entries[index] = { ...entries[index], id: newItemId };
    await this.db.lists.update(listId, { entries, updatedAt: new Date().toISOString() });
    this.mutationSeq.update((n) => n + 1);
  }

  async removeEntry(listId: string, entryId: string): Promise<void> {
    const list = await this.db.lists.get(listId);
    if (!list) {
      return;
    }
    await this.db.lists.update(listId, {
      entries: list.entries.filter((entry) => entry.id !== entryId),
      updatedAt: new Date().toISOString(),
    });
    this.mutationSeq.update((n) => n + 1);
  }

  /** ТІЛЬКИ для SyncService — як ItemsRepository.applyFromSync: не чіпає updatedAt. */
  applyFromSync(list: MediaList): Promise<string> {
    return this.db.lists.put(list);
  }
}
