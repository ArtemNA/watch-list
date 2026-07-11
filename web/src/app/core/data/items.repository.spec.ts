import { TestBed } from '@angular/core/testing';
import Dexie from 'dexie';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';

import { AppDb } from '../db/app-db';
import type { MediaItemPatch } from './items.repository';
import { ItemsRepository } from './items.repository';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('ItemsRepository', () => {
  let repo: ItemsRepository;
  let db: AppDb;

  beforeAll(() => {
    // Даємо Dexie fake-IndexedDB через ЙОГО точку впровадження (не globalThis:
    // `indexedDB` там read-only, а vi.stubGlobal авто-скидається між тестами,
    // ламаючи leaked liveQuery). ОДНА стабільна фабрика на весь файл; ізоляцію
    // даних забезпечує `db.delete()` в afterEach.
    Dexie.dependencies.indexedDB = new IDBFactory();
    Dexie.dependencies.IDBKeyRange = IDBKeyRange;
  });

  beforeEach(() => {
    repo = TestBed.inject(ItemsRepository);
    db = TestBed.inject(AppDb);
  });

  afterEach(async () => {
    // Знищуємо інжектор (toSignal відписує liveQuery) і чистимо базу для
    // ізоляції наступного тесту. Примітка: у повному прогоні кілька liveQuery-
    // сповіщень можуть долетіти під час крос-файлового тіру-дауну воркера й
    // осісти як "unhandled" — це відома взаємодія Dexie+vitest (див. step-05/06),
    // усі тести лишаються детермінованими.
    TestBed.resetTestingModule();
    await db.delete();
  });

  it('add generates id/createdAt/updatedAt and stores the given fields', async () => {
    const item = await repo.add({ kind: 'movie', status: 'want', title: 'Dune' });

    expect(item.id).toBeTruthy();
    expect(item.createdAt).toBe(item.updatedAt);
    expect(item.kind).toBe('movie');
    expect(item.status).toBe('want');
    expect(item.title).toBe('Dune');
    expect(item.links).toEqual([]);

    const stored = await repo.getById(item.id);
    expect(stored).toEqual(item);
  });

  it('update bumps updatedAt and rejects changes to id/createdAt', async () => {
    const item = await repo.add({ kind: 'movie', status: 'want', title: 'Dune' });
    await delay(5);

    const patch = {
      title: 'Dune (2021)',
      id: 'hacked-id',
      createdAt: '1999-01-01T00:00:00.000Z',
    } as MediaItemPatch;
    await repo.update(item.id, patch);

    const updated = await repo.getById(item.id);
    expect(updated?.id).toBe(item.id);
    expect(updated?.createdAt).toBe(item.createdAt);
    expect(updated?.title).toBe('Dune (2021)');
    expect(updated?.updatedAt).not.toBe(item.updatedAt);
  });

  it('softDelete hides the item from the list but keeps it visible in changedSince, restore brings it back', async () => {
    const item = await repo.add({ kind: 'tv', status: 'watching', title: 'Severance' });

    await repo.softDelete(item.id);

    const visibleAfterDelete = await db.items.filter((i) => !i.deletedAt).toArray();
    expect(visibleAfterDelete.some((i) => i.id === item.id)).toBe(false);

    const changed = await repo.changedSince('1970-01-01T00:00:00.000Z');
    const tombstone = changed.find((i) => i.id === item.id);
    expect(tombstone?.deletedAt).toBeTruthy();

    await repo.restore(item.id);

    const visibleAfterRestore = await db.items.filter((i) => !i.deletedAt).toArray();
    expect(visibleAfterRestore.some((i) => i.id === item.id)).toBe(true);
  });

  it('toggleFavorite flips favorite (undefined -> true -> false) and bumps updatedAt', async () => {
    const item = await repo.add({ kind: 'movie', status: 'want', title: 'Arrival' });
    expect(item.favorite).toBeUndefined();
    await delay(5);

    await repo.toggleFavorite(item.id);
    const favorited = await repo.getById(item.id);
    expect(favorited?.favorite).toBe(true);
    expect(favorited?.updatedAt).not.toBe(item.updatedAt);

    await repo.toggleFavorite(item.id);
    const unfavorited = await repo.getById(item.id);
    expect(unfavorited?.favorite).toBe(false);
  });

  it('changedSince filters items updated after the given timestamp', async () => {
    const before = new Date().toISOString();
    await delay(5);
    const item = await repo.add({ kind: 'movie', status: 'want', title: 'Arrival' });

    const changedAfterBefore = await repo.changedSince(before);
    expect(changedAfterBefore.map((i) => i.id)).toContain(item.id);

    const changedAfterItself = await repo.changedSince(item.updatedAt);
    expect(changedAfterItself.map((i) => i.id)).not.toContain(item.id);
  });
});
