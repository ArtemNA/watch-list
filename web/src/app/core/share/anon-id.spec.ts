import { TestBed } from '@angular/core/testing';
import Dexie from 'dexie';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';

import { AppDb } from '../db/app-db';
import { AnonIdService } from './anon-id';

describe('AnonIdService', () => {
  let db: AppDb;

  beforeAll(() => {
    Dexie.dependencies.indexedDB = new IDBFactory();
    Dexie.dependencies.IDBKeyRange = IDBKeyRange;
  });

  afterEach(async () => {
    TestBed.resetTestingModule();
    await db.delete();
  });

  it('generates an anon-<8 hex> id and persists it across instances', async () => {
    const first = TestBed.inject(AnonIdService);
    db = TestBed.inject(AppDb);
    const id = await first.getOrCreate();

    expect(id).toMatch(/^anon-[0-9a-f]{8}$/);

    TestBed.resetTestingModule();
    const second = TestBed.inject(AnonIdService);
    const idAgain = await second.getOrCreate();
    expect(idAgain).toBe(id);
  });

  it('caches in-memory — repeated calls on the same instance do not re-read meta', async () => {
    const service = TestBed.inject(AnonIdService);
    db = TestBed.inject(AppDb);

    const first = await service.getOrCreate();
    const second = await service.getOrCreate();
    expect(second).toBe(first);
  });
});
