import type { MediaItem } from '../models/media-item.model';
import type { ListEntry } from '../models/media-list.model';
import { entryFromItem, entryKey, mergeEntries } from './list-entry';

const ITEM: MediaItem = {
  id: 'item-1',
  kind: 'movie',
  status: 'want',
  title: 'Dune',
  originalTitle: 'Dune',
  year: 2021,
  posterUrl: 'https://example.test/dune.jpg',
  tmdbId: 438631,
  imdbId: 'tt1160419',
  links: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function entry(overrides: Partial<ListEntry>): ListEntry {
  return {
    id: 'entry-1',
    kind: 'movie',
    snapshot: { title: 'X' },
    addedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('entryFromItem', () => {
  it('snapshots title/originalTitle/year/posterUrl and keeps id === item.id (fallback резолву без tmdbId)', () => {
    const result = entryFromItem(ITEM);
    expect(result.id).toBe('item-1');
    expect(result.tmdbId).toBe(438631);
    expect(result.imdbId).toBe('tt1160419');
    expect(result.snapshot).toEqual({
      title: 'Dune',
      originalTitle: 'Dune',
      year: 2021,
      posterUrl: 'https://example.test/dune.jpg',
    });
  });

  it('манульний айтем без tmdbId лишає tmdbId undefined — резолв піде по id', () => {
    const manual: MediaItem = { ...ITEM, tmdbId: undefined, imdbId: undefined };
    const result = entryFromItem(manual);
    expect(result.tmdbId).toBeUndefined();
    expect(result.id).toBe('item-1');
  });
});

describe('entryKey', () => {
  it('пріоритет tmdbId над id', () => {
    expect(entryKey({ id: 'x', tmdbId: 5 })).toBe(entryKey({ id: 'y', tmdbId: 5 }));
    expect(entryKey({ id: 'x' })).not.toBe(entryKey({ id: 'y' }));
  });
});

describe('mergeEntries', () => {
  it('union за (tmdbId ?? id), без дублікатів', () => {
    const local = [entry({ id: 'a', tmdbId: 1 }), entry({ id: 'b' })];
    const remote = [entry({ id: 'c', tmdbId: 1 }), entry({ id: 'd' })];

    const merged = mergeEntries(local, remote);

    expect(merged.map((e) => e.id).sort()).toEqual(['a', 'b', 'd']);
  });

  it('видалений з одного боку запис "воскресає" — прийнятний компроміс без per-entry tombstones', () => {
    const local = [entry({ id: 'a', tmdbId: 1 })]; // видалили remote-only 'b' локально
    const remote = [entry({ id: 'a', tmdbId: 1 }), entry({ id: 'b', tmdbId: 2 })];

    const merged = mergeEntries(local, remote);

    expect(merged.map((e) => e.id).sort()).toEqual(['a', 'b']);
  });

  it('колізія ключа — лишає локальну версію', () => {
    const local = [entry({ id: 'local-copy', tmdbId: 1, sharedNotes: 'local' })];
    const remote = [entry({ id: 'remote-copy', tmdbId: 1, sharedNotes: 'remote' })];

    const merged = mergeEntries(local, remote);

    expect(merged).toEqual(local);
  });
});
