import { describe, expect, it } from 'vitest';

import { sanitizeSyncList } from './sync-validate';

function baseList(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Horror',
    entries: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function entry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'entry-1',
    kind: 'movie',
    snapshot: { title: 'Dune' },
    addedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('sanitizeSyncList — Mongo round-trip (фікс ревью Step 11: re-sync ламався)', () => {
  it('приймає список, де опційні поля прийшли з бекенда як null (undefined→null у Mongo)', () => {
    // Саме таку форму повертає pull після першого push: driver Mongo зберіг
    // undefined-поля як null. Раніше це відхилялось як INVALID_LISTS і робило
    // повторний синк списку з entries неможливим.
    const roundTripped = baseList({
      origin: null,
      entries: [entry({ sharedNotes: null, sharedLinks: null })],
    });
    const result = sanitizeSyncList(roundTripped);
    expect(result).not.toBeNull();
    expect(result?.origin).toBeUndefined();
    expect(result?.entries[0].sharedLinks).toBeUndefined();
    expect(result?.entries[0].sharedNotes).toBeUndefined();
  });
});

describe('sanitizeSyncList (Step 11)', () => {
  it('accepts a minimal valid list with empty entries', () => {
    const result = sanitizeSyncList(baseList());
    expect(result).not.toBeNull();
    expect(result?.entries).toEqual([]);
  });

  it('rejects a non-uuid id', () => {
    expect(sanitizeSyncList(baseList({ id: 'not-a-uuid' }))).toBeNull();
  });

  it('two lists with the same name both validate independently — names are never checked for uniqueness', () => {
    expect(sanitizeSyncList(baseList({ id: '11111111-1111-1111-1111-111111111111' }))).not.toBeNull();
    expect(sanitizeSyncList(baseList({ id: '22222222-2222-2222-2222-222222222222' }))).not.toBeNull();
  });

  it('sanitizes entries: keeps tmdbId/imdbId/snapshot, strips unknown fields', () => {
    const result = sanitizeSyncList(
      baseList({
        entries: [entry({ tmdbId: 438631, imdbId: 'tt1160419', evil: 'DROP TABLE users' })],
      }),
    );

    expect(result?.entries).toHaveLength(1);
    expect(result?.entries[0]).toEqual({
      id: 'entry-1',
      kind: 'movie',
      tmdbId: 438631,
      imdbId: 'tt1160419',
      snapshot: { title: 'Dune' },
      sharedNotes: undefined,
      sharedLinks: undefined,
      addedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('rejects the whole list if one entry is malformed (missing snapshot.title)', () => {
    const result = sanitizeSyncList(baseList({ entries: [entry({ snapshot: {} })] }));
    expect(result).toBeNull();
  });

  it('rejects an entry with an unknown kind', () => {
    const result = sanitizeSyncList(baseList({ entries: [entry({ kind: 'podcast' })] }));
    expect(result).toBeNull();
  });

  it('accepts sharedNotes/sharedLinks (Step 12 fields, model already carries them per ARCHITECTURE §9)', () => {
    const result = sanitizeSyncList(
      baseList({
        entries: [
          entry({
            sharedNotes: 'must watch',
            sharedLinks: [{ id: 'l1', label: 'Trailer', url: 'https://example.test' }],
          }),
        ],
      }),
    );

    expect(result?.entries[0].sharedNotes).toBe('must watch');
    expect(result?.entries[0].sharedLinks).toEqual([
      { id: 'l1', label: 'Trailer', url: 'https://example.test' },
    ]);
  });

  it('accepts origin (imported list) with sharedBy/sharedAt', () => {
    const result = sanitizeSyncList(
      baseList({ origin: { sharedBy: 'friend@example.com', sharedAt: '2026-02-01T00:00:00.000Z' } }),
    );
    expect(result?.origin).toEqual({ sharedBy: 'friend@example.com', sharedAt: '2026-02-01T00:00:00.000Z' });
  });

  it('rejects a malformed origin instead of silently dropping it', () => {
    const result = sanitizeSyncList(baseList({ origin: { sharedBy: 'friend@example.com' } }));
    expect(result).toBeNull();
  });

  it('drops unknown top-level fields', () => {
    const result = sanitizeSyncList(baseList({ evil: 'DROP TABLE users' }));
    expect(result).not.toHaveProperty('evil');
  });

  it('rejects a deletedAt that is not a valid ISO date', () => {
    expect(sanitizeSyncList(baseList({ deletedAt: 'yesterday' }))).toBeNull();
  });

  it('accepts a tombstone (deletedAt set)', () => {
    const result = sanitizeSyncList(baseList({ deletedAt: '2026-03-01T00:00:00.000Z' }));
    expect(result?.deletedAt).toBe('2026-03-01T00:00:00.000Z');
  });
});
