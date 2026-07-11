import { Injectable } from '@angular/core';
import Dexie, { type Table } from 'dexie';

import type { MediaItem } from '../models/media-item.model';

export interface MetaEntry {
  key: string;
  value: unknown;
}

@Injectable({ providedIn: 'root' })
export class AppDb extends Dexie {
  items!: Table<MediaItem, string>;
  meta!: Table<MetaEntry, string>;

  constructor() {
    super('watchlist');
    this.version(1).stores({
      items: 'id, status, kind, updatedAt, tmdbId',
      meta: 'key',
    });
  }
}
