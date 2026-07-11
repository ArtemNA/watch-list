import type { MediaItem } from '../models/media-item.model';
import type { ListEntry } from '../models/media-list.model';
import { buildPayload, decodeSharePayload, encodeSharePayload, parsePayload, type SharePayload } from './share-payload';

function entry(overrides: Partial<ListEntry> = {}): ListEntry {
  return {
    id: 'entry-1',
    kind: 'movie',
    tmdbId: 438631,
    snapshot: { title: 'Dune', year: 2021 },
    addedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function item(overrides: Partial<MediaItem> = {}): MediaItem {
  return {
    id: 'item-1',
    kind: 'movie',
    status: 'watched',
    tmdbId: 438631,
    title: 'Dune',
    notes: 'must watch on IMAX',
    links: [{ id: 'l1', label: 'Trailer', url: 'https://example.test/trailer' }],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function payload(overrides: Partial<SharePayload> = {}): SharePayload {
  return { v: 1, name: 'Watched', sharedBy: 'friend@example.com', entries: [entry()], ...overrides };
}

describe('buildPayload', () => {
  it('never includes myRating/status — the resolved item does not even carry them into the entry shape', () => {
    const result = buildPayload({ name: 'Watched', entries: [entry()] }, () => item(), 'me', {
      includeNotes: false,
      includeLinks: false,
    });
    expect(result.entries[0]).not.toHaveProperty('myRating');
    expect(result.entries[0]).not.toHaveProperty('status');
  });

  it('both checkboxes off (default) — sharedNotes/sharedLinks stay undefined even when the item has them', () => {
    const result = buildPayload({ name: 'Watched', entries: [entry()] }, () => item(), 'me', {
      includeNotes: false,
      includeLinks: false,
    });
    expect(result.entries[0].sharedNotes).toBeUndefined();
    expect(result.entries[0].sharedLinks).toBeUndefined();
  });

  it('includeNotes on — copies the resolved item notes as sharedNotes, links stay off', () => {
    const result = buildPayload({ name: 'Watched', entries: [entry()] }, () => item(), 'me', {
      includeNotes: true,
      includeLinks: false,
    });
    expect(result.entries[0].sharedNotes).toBe('must watch on IMAX');
    expect(result.entries[0].sharedLinks).toBeUndefined();
  });

  it('includeLinks on — copies the resolved item links as sharedLinks, notes stay off', () => {
    const result = buildPayload({ name: 'Watched', entries: [entry()] }, () => item(), 'me', {
      includeNotes: false,
      includeLinks: true,
    });
    expect(result.entries[0].sharedNotes).toBeUndefined();
    expect(result.entries[0].sharedLinks).toEqual([{ id: 'l1', label: 'Trailer', url: 'https://example.test/trailer' }]);
  });

  it('entry with no resolved item (not in sender library) — sharedNotes/sharedLinks stay undefined even with checkboxes on', () => {
    const result = buildPayload({ name: 'Watched', entries: [entry()] }, () => null, 'me', {
      includeNotes: true,
      includeLinks: true,
    });
    expect(result.entries[0].sharedNotes).toBeUndefined();
    expect(result.entries[0].sharedLinks).toBeUndefined();
  });

  it('sets sharedBy and v:1, preserves snapshot/tmdbId/kind', () => {
    const result = buildPayload({ name: 'Watched', entries: [entry()] }, () => null, 'anon-ab12cd34', {
      includeNotes: false,
      includeLinks: false,
    });
    expect(result.v).toBe(1);
    expect(result.sharedBy).toBe('anon-ab12cd34');
    expect(result.entries[0].snapshot).toEqual({ title: 'Dune', year: 2021 });
    expect(result.entries[0].tmdbId).toBe(438631);
  });
});

describe('parsePayload', () => {
  it('accepts a well-formed payload', () => {
    const result = parsePayload(payload());
    expect(result).not.toBeInstanceOf(Error);
    expect((result as SharePayload).entries).toHaveLength(1);
  });

  it('rejects a non-object', () => {
    expect(parsePayload('garbage')).toBeInstanceOf(Error);
    expect(parsePayload(null)).toBeInstanceOf(Error);
    expect(parsePayload(undefined)).toBeInstanceOf(Error);
  });

  it('rejects a version other than 1', () => {
    const error = parsePayload(payload({ v: 2 as never }));
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('INVALID_VERSION');
  });

  it('rejects a missing name or sharedBy', () => {
    expect(parsePayload({ ...payload(), name: '' })).toBeInstanceOf(Error);
    expect(parsePayload({ ...payload(), sharedBy: undefined })).toBeInstanceOf(Error);
  });

  it('rejects entries that are not an array', () => {
    expect(parsePayload({ ...payload(), entries: 'nope' })).toBeInstanceOf(Error);
  });

  it('rejects a malformed entry (missing snapshot.title)', () => {
    expect(parsePayload(payload({ entries: [{ ...entry(), snapshot: {} as never }] }))).toBeInstanceOf(Error);
  });

  it('rejects an entry with an unknown kind', () => {
    expect(parsePayload(payload({ entries: [{ ...entry(), kind: 'podcast' as never }] }))).toBeInstanceOf(Error);
  });

  it('drops a single malformed link instead of failing the whole payload', () => {
    const result = parsePayload(
      payload({ entries: [entry({ sharedLinks: [{ id: 'ok', label: 'Good', url: 'https://x.test' }, { bad: true } as never] })] }),
    );
    expect(result).not.toBeInstanceOf(Error);
    expect((result as SharePayload).entries[0].sharedLinks).toEqual([{ id: 'ok', label: 'Good', url: 'https://x.test' }]);
  });
});

describe('encodeSharePayload / decodeSharePayload', () => {
  it('round-trips a payload through base64url', () => {
    const original = payload();
    const code = encodeSharePayload(original);
    const decoded = decodeSharePayload(code);
    expect(decoded).toEqual(original);
  });

  it('is URL-safe (no +, /, or = characters)', () => {
    const code = encodeSharePayload(payload({ name: 'a'.repeat(50) }));
    expect(code).not.toMatch(/[+/=]/);
  });

  it('decodeSharePayload returns null for garbage input instead of throwing', () => {
    expect(decodeSharePayload('not-valid-base64!!!')).toBeNull();
    expect(decodeSharePayload('')).toBeNull();
  });
});
