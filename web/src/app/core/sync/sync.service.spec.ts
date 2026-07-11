import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import Dexie from 'dexie';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { of } from 'rxjs';

import { AppDb } from '../db/app-db';
import type { MediaItem } from '../models/media-item.model';
import type { ListEntry, MediaList } from '../models/media-list.model';
import { MetaRepository } from '../data/meta.repository';
import type {
  ConflictResolution,
  ListConflictResolution,
  ListSyncConflict,
  SyncConflict,
} from './sync.service';
import { SyncService } from './sync.service';

type AnyConflict = SyncConflict | ListSyncConflict;
type AnyResolution = ConflictResolution | ListConflictResolution;

/**
 * Крутить чергу мікрозадач/дінамічних import'ів, доки не з'явиться очікуваний
 * HTTP-запит, замість крихкого фіксованого delay — merge-діалог вантажиться
 * динамічним import(), і час на це не гарантований в одну мікрозадачу.
 */
async function nextRequest(mock: HttpTestingController, url: string) {
  // Матчимо по pathname (req.url), а не по повному рядку — GET-запити йдуть
  // з різним ?since=..., точний рядок-збіг би зламався.
  let req: ReturnType<HttpTestingController['expectOne']> | undefined;
  await vi.waitFor(() => {
    req = mock.expectOne((candidate) => candidate.url === url);
  });
  return req!;
}

class FakeDialog {
  // Один double обслуговує і openMergeDialog (items), і openListMergeDialog
  // (lists, Step 11) — обидва кличуть той самий injected MatDialog.
  readonly calls: { data: { conflicts: AnyConflict[] } }[] = [];
  private readonly queue: AnyResolution[][] = [];

  enqueue(resolutions: AnyResolution[]): void {
    this.queue.push(resolutions);
  }

  open(_component: unknown, config: { data: { conflicts: AnyConflict[] } }) {
    this.calls.push(config);
    const resolutions = this.queue.shift() ?? [];
    return { afterClosed: () => of(resolutions) };
  }
}

const BASE = {
  id: 'item-1',
  kind: 'movie' as const,
  status: 'watched' as const,
  title: 'Test Movie',
  links: [],
  createdAt: '2026-01-01T00:00:00.000Z',
};

function listEntry(overrides: Partial<ListEntry>): ListEntry {
  return {
    id: 'entry-a',
    kind: 'movie',
    snapshot: { title: 'X' },
    addedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const BASE_LIST = {
  id: 'list-1',
  name: 'Horror',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('SyncService — авто vs інтерактивний синк (step-09, задача 4г)', () => {
  let sync: SyncService;
  let db: AppDb;
  let meta: MetaRepository;
  let httpMock: HttpTestingController;
  let fakeDialog: FakeDialog;

  beforeAll(() => {
    // Той самий стабільний патерн, що й items.repository.spec / step-08 (DECISIONS #21).
    Dexie.dependencies.indexedDB = new IDBFactory();
    Dexie.dependencies.IDBKeyRange = IDBKeyRange;
  });

  beforeEach(async () => {
    localStorage.clear();
    // Юзер вже залогінений — конструктор SyncService одразу тригерить
    // неінтерактивний startup-автосинк (ARCHITECTURE §6).
    localStorage.setItem('watchlist.auth.token', 'test-token');
    localStorage.setItem('watchlist.auth.email', 'test@example.com');

    fakeDialog = new FakeDialog();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialog, useValue: fakeDialog },
      ],
    });

    db = TestBed.inject(AppDb);
    meta = TestBed.inject(MetaRepository);
    httpMock = TestBed.inject(HttpTestingController);
    sync = TestBed.inject(SyncService);

    // Поглинаємо порожній startup-синк, щоб він не заважав сценарію тесту.
    // Items, потім lists — той самий послідовний цикл, що runSync (Step 11).
    const startupReq = await nextRequest(httpMock, '/api/sync/items');
    startupReq.flush({ items: [], next: null, serverTime: 'T0' });
    const startupListsReq = await nextRequest(httpMock, '/api/sync/lists');
    startupListsReq.flush({ items: [], next: null, serverTime: 'LT0' });
    await vi.waitFor(() => {
      if (sync.isSyncing()) {
        throw new Error('startup sync still running');
      }
    });
  });

  afterEach(async () => {
    httpMock.verify();
    TestBed.resetTestingModule();
    await db.delete();
    localStorage.clear();
  });

  it('неінтерактивний синк не відкриває діалог і не рухає маркери при конфлікті; повторний інтерактивний показує ТУ САМУ пару й після рішення просуває маркери', async () => {
    // Локальна і "хмарна" версії того самого айтема розходяться лише в myRating
    // (8 проти 7) — це конфлікт (обидва боки непусті й різні), а не автозлиття.
    // Сідимо напряму в Dexie (не через ItemsRepository.add), щоб не чіпати
    // debounce-тригер мутацій — тут перевіряється інша гілка автосинку.
    const local: MediaItem = { ...BASE, myRating: 8, updatedAt: '2026-07-11T10:00:00.000Z' };
    await db.items.add(local);
    const remote: MediaItem = { ...BASE, myRating: 7, updatedAt: '2026-07-11T10:05:00.000Z' };

    // --- 1. Автосинк (interactive: false): конфлікт знайдено, але діалог НЕ відкривається ---
    const autoPromise = sync.sync({ interactive: false, silent: true });
    const autoReq = await nextRequest(httpMock, '/api/sync/items');
    autoReq.flush({ items: [remote], next: null, serverTime: 'T1' });
    const autoListsReq = await nextRequest(httpMock, '/api/sync/lists');
    autoListsReq.flush({ items: [], next: null, serverTime: 'LT1' });
    await autoPromise;

    expect(fakeDialog.calls.length).toBe(0);
    expect(sync.pendingConflicts()).toBe(1);
    // Маркери НЕ просунулись до T1 (лишились там, де їх поставив порожній
    // startup-синк) — інакше наступний pull більше не побачив би конфлікт.
    expect(await meta.get('sync.lastServerTime')).toBe('T0');
    expect(await meta.get('sync.lastPushAt')).toBeUndefined();

    // --- 2. Інтерактивний синк: та сама пара знову приходить і відкриває діалог ---
    const resolved: MediaItem = { ...local, myRating: 8, updatedAt: '2026-07-11T10:10:00.000Z' };
    fakeDialog.enqueue([{ kind: 'resolved', item: resolved }]);

    const interactivePromise = sync.sync({ interactive: true });
    const secondReq = await nextRequest(httpMock, '/api/sync/items');
    secondReq.flush({ items: [remote], next: null, serverTime: 'T2' });

    // Push злитого результату — POST-запит на той самий шлях.
    const pushReq = await nextRequest(httpMock, '/api/sync/items');
    pushReq.flush({ saved: ['item-1'], conflicts: [] });
    const secondListsReq = await nextRequest(httpMock, '/api/sync/lists');
    secondListsReq.flush({ items: [], next: null, serverTime: 'LT2' });
    await interactivePromise;

    expect(fakeDialog.calls.length).toBe(1);
    const shownConflict = fakeDialog.calls[0].data.conflicts[0];
    expect(shownConflict.fields).toEqual([{ field: 'myRating', local: 8, remote: 7 }]);

    // Конфлікт вирішено — бейдж очищено, маркери просунулись.
    expect(sync.pendingConflicts()).toBe(0);
    expect(await meta.get('sync.lastServerTime')).toBe('T2');
    expect(await meta.get('sync.lastPushAt')).toBe('2026-07-11T10:10:00.000Z');
  });

  it('луна власного пуша НЕ стає хибним конфліктом: редагування після синку просто пушиться (фікс ревью step-09)', async () => {
    // Крок 1: айтем v1 успішно пушиться (стає "узгодженою" версією в baseVersions).
    const v1: MediaItem = { ...BASE, myRating: 7, updatedAt: '2026-07-11T10:00:00.000Z' };
    await db.items.add(v1);

    const firstPromise = sync.sync({ interactive: true });
    const firstPull = await nextRequest(httpMock, '/api/sync/items');
    firstPull.flush({ items: [], next: null, serverTime: 'T1' });
    const firstPush = await nextRequest(httpMock, '/api/sync/items');
    expect(firstPush.request.method).toBe('POST');
    firstPush.flush({ saved: ['item-1'], conflicts: [] });
    const firstListsPull = await nextRequest(httpMock, '/api/sync/lists');
    firstListsPull.flush({ items: [], next: null, serverTime: 'LT1' });
    await firstPromise;

    // Крок 2: юзер редагує айтем (v2 локально). Наступний pull повертає ЛУНУ
    // v1 (serverUpdatedAt > lastServerTime, бо наш пуш бампнув її після pull).
    const v2: MediaItem = { ...v1, myRating: 9, updatedAt: '2026-07-11T10:20:00.000Z' };
    await db.items.put(v2);

    const secondPromise = sync.sync({ interactive: true });
    const secondPull = await nextRequest(httpMock, '/api/sync/items');
    secondPull.flush({ items: [v1], next: null, serverTime: 'T2' });
    // Без ехо-фільтра тут відкрився б merge-діалог (myRating 9 vs 7).
    const secondPush = await nextRequest(httpMock, '/api/sync/items');
    expect(secondPush.request.method).toBe('POST');
    expect((secondPush.request.body as { items: MediaItem[] }).items[0].myRating).toBe(9);
    secondPush.flush({ saved: ['item-1'], conflicts: [] });
    const secondListsPull = await nextRequest(httpMock, '/api/sync/lists');
    secondListsPull.flush({ items: [], next: null, serverTime: 'LT2' });
    const summary = await secondPromise;

    expect(fakeDialog.calls.length).toBe(0); // жодного діалогу
    expect(summary?.conflicts).toBe(0);
    expect(sync.pendingConflicts()).toBe(0);
    expect(await meta.get('sync.lastServerTime')).toBe('T2');
  });

  it('після помилки синку повторний sync() ПРАЦЮЄ (стан error не замикає синк назавжди — фікс ревью step-11)', async () => {
    // Крок 1: синк падає (мережа/бекенд) → стан 'error'.
    const failedPromise = sync.sync({ interactive: true }).catch(() => 'failed');
    const failedPull = await nextRequest(httpMock, '/api/sync/items');
    failedPull.flush({ error: 'INTERNAL_ERROR' }, { status: 500, statusText: 'Server Error' });
    expect(await failedPromise).toBe('failed');
    expect(sync.state()).toBe('error');

    // Крок 2: «натисніть, щоб повторити» — повторний виклик має зробити НОВИЙ
    // запит (з guard'ом `state() !== 'idle'` він мовчки повертав null).
    const retryPromise = sync.sync({ interactive: true });
    const retryPull = await nextRequest(httpMock, '/api/sync/items');
    retryPull.flush({ items: [], next: null, serverTime: 'T1' });
    const retryListsPull = await nextRequest(httpMock, '/api/sync/lists');
    retryListsPull.flush({ items: [], next: null, serverTime: 'LT1' });
    const summary = await retryPromise;

    expect(summary).not.toBeNull();
    expect(sync.state()).toBe('idle');
  });
});

describe('SyncService — синк колекції lists (Step 11, ARCHITECTURE §9)', () => {
  let sync: SyncService;
  let db: AppDb;
  let httpMock: HttpTestingController;
  let fakeDialog: FakeDialog;

  beforeAll(() => {
    Dexie.dependencies.indexedDB = new IDBFactory();
    Dexie.dependencies.IDBKeyRange = IDBKeyRange;
  });

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('watchlist.auth.token', 'test-token');
    localStorage.setItem('watchlist.auth.email', 'test@example.com');

    fakeDialog = new FakeDialog();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialog, useValue: fakeDialog },
      ],
    });

    db = TestBed.inject(AppDb);
    httpMock = TestBed.inject(HttpTestingController);
    sync = TestBed.inject(SyncService);

    const startupReq = await nextRequest(httpMock, '/api/sync/items');
    startupReq.flush({ items: [], next: null, serverTime: 'T0' });
    const startupListsReq = await nextRequest(httpMock, '/api/sync/lists');
    startupListsReq.flush({ items: [], next: null, serverTime: 'LT0' });
    await vi.waitFor(() => {
      if (sync.isSyncing()) {
        throw new Error('startup sync still running');
      }
    });
  });

  afterEach(async () => {
    httpMock.verify();
    TestBed.resetTestingModule();
    await db.delete();
    localStorage.clear();
  });

  it('конфлікт name відкриває ListMergeDialog, а entries зливаються автоматично union — БЕЗ питань, навіть у base конфлікту', async () => {
    const entryA = listEntry({ id: 'a', tmdbId: 1 });
    const entryB = listEntry({ id: 'b', tmdbId: 2 });
    const local: MediaList = {
      ...BASE_LIST,
      name: 'Local Name',
      entries: [entryA],
      updatedAt: '2026-07-11T10:00:00.000Z',
    };
    await db.lists.add(local);
    const remote: MediaList = {
      ...BASE_LIST,
      name: 'Remote Name',
      entries: [entryB],
      updatedAt: '2026-07-11T10:05:00.000Z',
    };

    const resolved: MediaList = { ...local, name: 'Local Name', entries: [entryA, entryB] };
    fakeDialog.enqueue([{ kind: 'resolved', item: resolved }]);

    const promise = sync.sync({ interactive: true });
    const itemsReq = await nextRequest(httpMock, '/api/sync/items');
    itemsReq.flush({ items: [], next: null, serverTime: 'T1' });
    const listsPull = await nextRequest(httpMock, '/api/sync/lists');
    listsPull.flush({ items: [remote], next: null, serverTime: 'LT1' });
    const listsPush = await nextRequest(httpMock, '/api/sync/lists');
    listsPush.flush({ saved: ['list-1'], conflicts: [] });
    await promise;

    expect(fakeDialog.calls.length).toBe(1);
    const shownConflict = fakeDialog.calls[0].data.conflicts[0] as ListSyncConflict;
    expect(shownConflict.fields).toEqual([{ field: 'name', local: 'Local Name', remote: 'Remote Name' }]);
    // Entries вже об'єднані в base конфлікту — юзера НІКОЛИ не питають про склад списку.
    expect(shownConflict.base?.entries.map((e) => e.id).sort()).toEqual(['a', 'b']);

    expect(sync.pendingConflicts()).toBe(0);
  });

  it('без конфліктів entries тихо зливаються (union) і пушаться — без відкриття діалогу взагалі', async () => {
    const entryA = listEntry({ id: 'a', tmdbId: 1 });
    const entryB = listEntry({ id: 'b', tmdbId: 2 });
    const local: MediaList = { ...BASE_LIST, entries: [entryA], updatedAt: '2026-07-11T10:00:00.000Z' };
    await db.lists.add(local);
    const remote: MediaList = { ...BASE_LIST, entries: [entryB], updatedAt: '2026-07-11T10:05:00.000Z' };

    const promise = sync.sync({ interactive: true });
    const itemsReq = await nextRequest(httpMock, '/api/sync/items');
    itemsReq.flush({ items: [], next: null, serverTime: 'T1' });
    const listsPull = await nextRequest(httpMock, '/api/sync/lists');
    listsPull.flush({ items: [remote], next: null, serverTime: 'LT1' });
    const listsPush = await nextRequest(httpMock, '/api/sync/lists');
    const pushedBody = listsPush.request.body as { items: MediaList[] };
    expect(pushedBody.items[0].entries.map((e) => e.id).sort()).toEqual(['a', 'b']);
    listsPush.flush({ saved: ['list-1'], conflicts: [] });
    await promise;

    expect(fakeDialog.calls.length).toBe(0);

    const merged = await db.lists.get('list-1');
    expect(merged?.entries.map((e) => e.id).sort()).toEqual(['a', 'b']);
  });
});
