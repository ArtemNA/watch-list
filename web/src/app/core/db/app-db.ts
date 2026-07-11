import { Injectable } from '@angular/core';
import Dexie, { type Table } from 'dexie';

import type { MediaList } from '../models/media-list.model';
import type { MediaItem } from '../models/media-item.model';

export interface MetaEntry {
  key: string;
  value: unknown;
}

@Injectable({ providedIn: 'root' })
export class AppDb extends Dexie {
  items!: Table<MediaItem, string>;
  meta!: Table<MetaEntry, string>;
  lists!: Table<MediaList, string>;

  constructor() {
    super('watchlist');
    this.version(1).stores({
      items: 'id, status, kind, updatedAt, tmdbId',
      meta: 'key',
    });
    // Step 11: нова таблиця `lists` + `favorite?` на MediaItem. `favorite` не
    // індексується (фільтр працює через .filter() на items-сигналі, як і решта
    // фільтрів бібліотеки) — індекси items навмисно НЕ змінюються (крок 11,
    // "Індекси items не ламати"). Існуючі записи items просто не мають поля
    // favorite (undefined === false), Dexie нічого не переписує при апгрейді
    // без stores-diff на самій таблиці items.
    this.version(2).stores({
      items: 'id, status, kind, updatedAt, tmdbId',
      meta: 'key',
      lists: 'id, updatedAt',
    });
  }
}
