import type { MediaItem } from '../../core/models/media-item.model';
import { findExistingItemId } from './preview-redirect';

function item(overrides: Partial<MediaItem> = {}): MediaItem {
  return {
    id: '1',
    kind: 'movie',
    status: 'want',
    title: 'Дюна',
    links: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('findExistingItemId', () => {
  it('returns the id of the item matching both kind and tmdbId', () => {
    const items = [item({ id: 'a', tmdbId: 1 }), item({ id: 'b', tmdbId: 438631 })];

    expect(findExistingItemId(items, 'movie', 438631)).toBe('b');
  });

  it('returns undefined when no item matches the tmdbId', () => {
    const items = [item({ id: 'a', tmdbId: 1 })];

    expect(findExistingItemId(items, 'movie', 438631)).toBeUndefined();
  });

  it('does not match a different kind with the same tmdbId (movie vs tv are separate TMDB namespaces)', () => {
    const items = [item({ id: 'a', kind: 'tv', tmdbId: 438631 })];

    expect(findExistingItemId(items, 'movie', 438631)).toBeUndefined();
  });

  it('returns undefined for items without a tmdbId (manually added)', () => {
    const items = [item({ id: 'a', tmdbId: undefined })];

    expect(findExistingItemId(items, 'movie', 438631)).toBeUndefined();
  });
});
