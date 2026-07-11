import { describe, expect, it } from 'vitest';

import { sanitizeSharePayload } from './share-validate';

function entry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'entry-1',
    kind: 'movie',
    snapshot: { title: 'Dune' },
    addedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    v: 1,
    name: 'Watched',
    sharedBy: 'friend@example.com',
    entries: [entry()],
    ...overrides,
  };
}

describe('sanitizeSharePayload', () => {
  it('accepts a minimal valid payload', () => {
    const result = sanitizeSharePayload(payload());
    expect(result).not.toBeNull();
    expect(result?.entries).toHaveLength(1);
  });

  it('accepts an empty-entries payload (sharing a brand-new empty list is allowed)', () => {
    const result = sanitizeSharePayload(payload({ entries: [] }));
    expect(result?.entries).toEqual([]);
  });

  it('rejects a non-object body', () => {
    expect(sanitizeSharePayload('nope')).toBeNull();
    expect(sanitizeSharePayload(null)).toBeNull();
  });

  it('rejects a version other than 1', () => {
    expect(sanitizeSharePayload(payload({ v: 2 }))).toBeNull();
    expect(sanitizeSharePayload(payload({ v: '1' }))).toBeNull();
  });

  it('rejects a missing/blank name or sharedBy', () => {
    expect(sanitizeSharePayload(payload({ name: '' }))).toBeNull();
    expect(sanitizeSharePayload(payload({ name: '   ' }))).toBeNull();
    expect(sanitizeSharePayload(payload({ sharedBy: undefined }))).toBeNull();
  });

  it('rejects entries that are not an array', () => {
    expect(sanitizeSharePayload(payload({ entries: 'nope' }))).toBeNull();
  });

  it('rejects more than 1000 entries', () => {
    const entries = Array.from({ length: 1001 }, (_, i) => entry({ id: `e${i}` }));
    expect(sanitizeSharePayload(payload({ entries }))).toBeNull();
  });

  it('accepts exactly 1000 entries', () => {
    const entries = Array.from({ length: 1000 }, (_, i) => entry({ id: `e${i}` }));
    expect(sanitizeSharePayload(payload({ entries }))?.entries).toHaveLength(1000);
  });

  it('rejects the whole payload if one entry is malformed', () => {
    expect(sanitizeSharePayload(payload({ entries: [entry({ snapshot: {} })] }))).toBeNull();
  });

  it('drops unknown top-level fields', () => {
    const result = sanitizeSharePayload(payload({ evil: 'DROP TABLE users' }));
    expect(result).not.toHaveProperty('evil');
  });

  it('preserves sharedNotes/sharedLinks on entries when present', () => {
    const result = sanitizeSharePayload(
      payload({
        entries: [entry({ sharedNotes: 'must watch', sharedLinks: [{ id: 'l1', label: 'Trailer', url: 'https://x.test' }] })],
      }),
    );
    expect(result?.entries[0].sharedNotes).toBe('must watch');
    expect(result?.entries[0].sharedLinks).toEqual([{ id: 'l1', label: 'Trailer', url: 'https://x.test' }]);
  });

  it('rejects a payload larger than 256KB', () => {
    const bigEntries = Array.from({ length: 1000 }, (_, i) =>
      entry({ id: `e${i}`, sharedNotes: 'x'.repeat(500) }),
    );
    expect(sanitizeSharePayload(payload({ entries: bigEntries }))).toBeNull();
  });
});
