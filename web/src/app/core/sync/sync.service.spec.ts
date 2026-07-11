import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import Dexie from 'dexie';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { of } from 'rxjs';

import { AppDb } from '../db/app-db';
import type { MediaItem } from '../models/media-item.model';
import { MetaRepository } from '../data/meta.repository';
import type { ConflictResolution, SyncConflict } from './sync.service';
import { SyncService } from './sync.service';

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
  readonly calls: { data: { conflicts: SyncConflict[] } }[] = [];
  private readonly queue: ConflictResolution[][] = [];

  enqueue(resolutions: ConflictResolution[]): void {
    this.queue.push(resolutions);
  }

  open(_component: unknown, config: { data: { conflicts: SyncConflict[] } }) {
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
    const startupReq = await nextRequest(httpMock, '/api/sync/items');
    startupReq.flush({ items: [], next: null, serverTime: 'T0' });
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
    const summary = await secondPromise;

    expect(fakeDialog.calls.length).toBe(0); // жодного діалогу
    expect(summary?.conflicts).toBe(0);
    expect(sync.pendingConflicts()).toBe(0);
    expect(await meta.get('sync.lastServerTime')).toBe('T2');
  });
});
