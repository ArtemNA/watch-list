import { TestBed } from '@angular/core/testing';
import Dexie from 'dexie';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';

import { AppDb } from '../db/app-db';
import type { ListEntry } from '../models/media-list.model';
import { ListsRepository } from './lists.repository';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function entry(overrides: Partial<ListEntry>): Omit<ListEntry, 'addedAt'> {
  return {
    id: 'entry-1',
    kind: 'movie',
    snapshot: { title: 'X' },
    ...overrides,
  };
}

describe('ListsRepository', () => {
  let repo: ListsRepository;
  let db: AppDb;

  beforeAll(() => {
    Dexie.dependencies.indexedDB = new IDBFactory();
    Dexie.dependencies.IDBKeyRange = IDBKeyRange;
  });

  beforeEach(() => {
    repo = TestBed.inject(ListsRepository);
    db = TestBed.inject(AppDb);
  });

  afterEach(async () => {
    TestBed.resetTestingModule();
    await db.delete();
  });

  it('create generates id/createdAt/updatedAt, empty entries; two lists with the same name coexist (uuid identity)', async () => {
    const a = await repo.create('Horror');
    const b = await repo.create('Horror');

    expect(a.id).not.toBe(b.id);
    expect(a.name).toBe('Horror');
    expect(a.entries).toEqual([]);
    expect(a.createdAt).toBe(a.updatedAt);

    const stored = await repo.getById(a.id);
    expect(stored).toEqual(a);
  });

  it('rename/updateDescription bump updatedAt without touching entries', async () => {
    const list = await repo.create('Sci-fi');
    await repo.addEntry(list.id, entry({ id: 'e1', tmdbId: 1 }));

    await repo.rename(list.id, 'Sci-fi & Fantasy');
    await repo.updateDescription(list.id, 'best of the genre');

    const updated = await repo.getById(list.id);
    expect(updated?.name).toBe('Sci-fi & Fantasy');
    expect(updated?.description).toBe('best of the genre');
    expect(updated?.entries).toHaveLength(1);
  });

  it('addEntry dedups within a list by (tmdbId ?? id) — re-adding is a no-op', async () => {
    const list = await repo.create('Watchlist');

    await repo.addEntry(list.id, entry({ id: 'e1', tmdbId: 42 }));
    await repo.addEntry(list.id, entry({ id: 'e2', tmdbId: 42 })); // same tmdbId, different entry id
    await repo.addEntry(list.id, entry({ id: 'e3' })); // no tmdbId
    await repo.addEntry(list.id, entry({ id: 'e3' })); // same id, no-op

    const stored = await repo.getById(list.id);
    expect(stored?.entries).toHaveLength(2);
  });

  it('removeEntry removes only the given entry, list stays otherwise intact', async () => {
    const list = await repo.create('Watchlist');
    await repo.addEntry(list.id, entry({ id: 'e1', tmdbId: 1 }));
    await repo.addEntry(list.id, entry({ id: 'e2', tmdbId: 2 }));

    await repo.removeEntry(list.id, 'e1');

    const stored = await repo.getById(list.id);
    expect(stored?.entries.map((e) => e.id)).toEqual(['e2']);
  });

  it('relinkEntry swaps the id of the given entry (Step 11: "+ to library" for tmdbId-less entries)', async () => {
    const list = await repo.create('Watchlist');
    await repo.addEntry(list.id, entry({ id: 'old-item-id' })); // без tmdbId — резолв по id

    await repo.relinkEntry(list.id, 'old-item-id', 'new-item-id');

    const stored = await repo.getById(list.id);
    expect(stored?.entries).toHaveLength(1);
    expect(stored?.entries[0].id).toBe('new-item-id');
  });

  it('softDelete hides the list from `lists` signal source but keeps it in changedSince; restore brings it back — items are never touched', async () => {
    const list = await repo.create('To delete');

    await repo.softDelete(list.id);

    const visibleAfterDelete = await db.lists.filter((l) => !l.deletedAt).toArray();
    expect(visibleAfterDelete.some((l) => l.id === list.id)).toBe(false);

    const changed = await repo.changedSince('1970-01-01T00:00:00.000Z');
    expect(changed.find((l) => l.id === list.id)?.deletedAt).toBeTruthy();

    await repo.restore(list.id);

    const visibleAfterRestore = await db.lists.filter((l) => !l.deletedAt).toArray();
    expect(visibleAfterRestore.some((l) => l.id === list.id)).toBe(true);
  });

  it('createImported creates a new list with entries and origin already set (Step 12 import — never overwrites by name)', async () => {
    const entries = [{ ...entry({ id: 'e1', tmdbId: 1 }), addedAt: '2026-01-01T00:00:00.000Z' }];
    const origin = { sharedBy: 'friend@example.com', sharedAt: '2026-01-02T00:00:00.000Z' };

    const a = await repo.createImported('«Watched» — від friend@example.com', entries, origin);
    const b = await repo.createImported('«Watched» — від friend@example.com', entries, origin);

    expect(a.id).not.toBe(b.id);
    expect(a.entries).toEqual(entries);
    expect(a.origin).toEqual(origin);
    expect(a.createdAt).toBe(a.updatedAt);

    const stored = await repo.getById(a.id);
    expect(stored).toEqual(a);
  });

  it('changedSince filters lists updated after the given timestamp', async () => {
    const before = new Date().toISOString();
    await delay(5);
    const list = await repo.create('Fresh');

    const changedAfterBefore = await repo.changedSince(before);
    expect(changedAfterBefore.map((l) => l.id)).toContain(list.id);

    const changedAfterItself = await repo.changedSince(list.updatedAt);
    expect(changedAfterItself.map((l) => l.id)).not.toContain(list.id);
  });
});
