import { TestBed } from '@angular/core/testing';
import Dexie from 'dexie';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';

import type { MediaItem } from '../models/media-item.model';
import { AppDb } from './app-db';

const V1_ITEM: MediaItem = {
  id: 'legacy-1',
  kind: 'movie',
  status: 'watched',
  title: 'Legacy Movie',
  links: [],
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

describe('AppDb migration v1 -> v2 (Step 11)', () => {
  beforeAll(() => {
    Dexie.dependencies.indexedDB = new IDBFactory();
    Dexie.dependencies.IDBKeyRange = IDBKeyRange;
  });

  it('база v1 з айтемами відкривається як v2 без втрат, нова таблиця lists доступна, favorite відсутній (undefined)', async () => {
    // 1. Створюємо базу ЛИШЕ зі схемою v1 (як у старій версії апки) і сідимо айтем.
    const legacyDb = new Dexie('watchlist');
    legacyDb.version(1).stores({
      items: 'id, status, kind, updatedAt, tmdbId',
      meta: 'key',
    });
    await legacyDb.open();
    await legacyDb.table('items').add(V1_ITEM);
    legacyDb.close();

    // 2. Відкриваємо ту саму базу через реальний AppDb (v1+v2) — Dexie сам виконає апгрейд.
    const db = TestBed.inject(AppDb);
    await db.open();

    const migrated = await db.items.get('legacy-1');
    expect(migrated).toEqual(V1_ITEM);
    expect(migrated?.favorite).toBeUndefined();

    await db.lists.add({
      id: 'list-1',
      name: 'Test list',
      entries: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const list = await db.lists.get('list-1');
    expect(list?.name).toBe('Test list');

    await db.delete();
  });
});
