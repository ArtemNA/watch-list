import type { ListEntry, MediaList } from '../models/media-list.model';
import { mergeLists, resolveListDeletedVsEdited } from './merge-lists';

const NOW = '2026-07-11T12:00:00.000Z';

function entry(overrides: Partial<ListEntry> = {}): ListEntry {
  return {
    id: 'entry-1',
    kind: 'movie',
    snapshot: { title: 'Dune' },
    addedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function list(overrides: Partial<MediaList> = {}): MediaList {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Horror',
    entries: [],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z',
    ...overrides,
  };
}

describe('mergeLists', () => {
  it('identical для змістовно однакових версій (різний порядок entries не заважає)', () => {
    const a = entry({ id: 'a', tmdbId: 1 });
    const b = entry({ id: 'b', tmdbId: 2 });
    const local = list({ entries: [a, b] });
    const remote = list({ entries: [b, a], updatedAt: '2026-07-10T05:00:00.000Z' });
    expect(mergeLists(local, remote, NOW)).toEqual({ kind: 'identical' });
  });

  it('entries відрізняються (union) → merged, БЕЗ конфлікту навіть якщо назва однакова', () => {
    const a = entry({ id: 'a', tmdbId: 1 });
    const b = entry({ id: 'b', tmdbId: 2 });
    const local = list({ entries: [a] });
    const remote = list({ entries: [b], updatedAt: '2026-07-10T05:00:00.000Z' });

    const result = mergeLists(local, remote, NOW);

    expect(result.kind).toBe('merged');
    if (result.kind === 'merged') {
      expect(result.item.entries.map((e) => e.id).sort()).toEqual(['a', 'b']);
      expect(result.item.updatedAt).toBe(NOW);
    }
  });

  it('різні назви → конфлікт поля name; entries все одно зливаються автоматично в base', () => {
    const a = entry({ id: 'a', tmdbId: 1 });
    const b = entry({ id: 'b', tmdbId: 2 });
    const local = list({ name: 'Horror', entries: [a] });
    const remote = list({ name: 'Scary movies', entries: [b] });

    const result = mergeLists(local, remote, NOW);

    expect(result.kind).toBe('conflict');
    if (result.kind === 'conflict') {
      expect(result.fields).toEqual([{ field: 'name', local: 'Horror', remote: 'Scary movies' }]);
      expect(result.base.entries.map((e) => e.id).sort()).toEqual(['a', 'b']);
    }
  });

  it('пустий опис локально + заповнений в хмарі → авто-злиття без конфлікту', () => {
    const local = list({ description: undefined });
    const remote = list({ description: 'best of the genre', updatedAt: '2026-07-10T05:00:00.000Z' });
    expect(mergeLists(local, remote, NOW)).toEqual({ kind: 'useRemote' });
  });

  it('обидва боки видалено — лишає свіжішу tombstone-версію', () => {
    const local = list({ deletedAt: '2026-07-11T00:00:00.000Z', updatedAt: '2026-07-11T00:00:00.000Z' });
    const remote = list({ deletedAt: '2026-07-10T00:00:00.000Z', updatedAt: '2026-07-10T00:00:00.000Z' });
    expect(mergeLists(local, remote, NOW)).toEqual({ kind: 'useLocal' });
  });

  it('видалено локально, редаговано в хмарі (інший контент) → deletedVsEdited', () => {
    const local = list({ deletedAt: NOW, updatedAt: NOW });
    const remote = list({ name: 'Renamed', updatedAt: '2026-07-10T05:00:00.000Z' });

    const result = mergeLists(local, remote, NOW);

    expect(result).toEqual({ kind: 'deletedVsEdited', deletedSide: 'local' });
  });

  it('видалення без реальних інших змін НЕ конфліктує — видалення перемагає', () => {
    const base = list();
    const local = { ...base, deletedAt: NOW, updatedAt: NOW };
    const remote = base;
    expect(mergeLists(local, remote, NOW)).toEqual({ kind: 'useLocal' });
  });
});

describe('resolveListDeletedVsEdited', () => {
  it('restore бере редаговану версію і знімає tombstone', () => {
    const local = list({ deletedAt: NOW, updatedAt: NOW });
    const remote = list({ name: 'Renamed', updatedAt: '2026-07-10T05:00:00.000Z' });

    const result = resolveListDeletedVsEdited(local, remote, 'local', 'restore', NOW);

    expect(result.name).toBe('Renamed');
    expect(result.deletedAt).toBeNull();
  });

  it('delete лишає tombstone на редагованій версії', () => {
    const local = list({ deletedAt: NOW, updatedAt: NOW });
    const remote = list({ name: 'Renamed', updatedAt: '2026-07-10T05:00:00.000Z' });

    const result = resolveListDeletedVsEdited(local, remote, 'local', 'delete', NOW);

    expect(result.name).toBe('Renamed');
    expect(result.deletedAt).toBe(NOW);
  });
});
