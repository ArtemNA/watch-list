import type { MediaItem } from '../../core/models/media-item.model';
import { DEFAULT_LIBRARY_FILTERS, filterAndSortItems } from './library-filters';

function item(overrides: Partial<MediaItem>): MediaItem {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    kind: 'movie',
    status: 'want',
    title: 'Untitled',
    links: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('filterAndSortItems', () => {
  it('returns items unchanged in default order (addedDesc) when no filters applied', () => {
    const items = [
      item({ id: 'a', title: 'A', createdAt: '2026-01-01T00:00:00.000Z' }),
      item({ id: 'b', title: 'B', createdAt: '2026-01-03T00:00:00.000Z' }),
      item({ id: 'c', title: 'C', createdAt: '2026-01-02T00:00:00.000Z' }),
    ];

    const result = filterAndSortItems(items, DEFAULT_LIBRARY_FILTERS);

    expect(result.map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('filters by status', () => {
    const items = [
      item({ id: 'a', status: 'want' }),
      item({ id: 'b', status: 'watched' }),
      item({ id: 'c', status: 'watched' }),
    ];

    const result = filterAndSortItems(items, { ...DEFAULT_LIBRARY_FILTERS, status: 'watched' });

    expect(result.map((i) => i.id).sort()).toEqual(['b', 'c']);
  });

  it('filters by kind', () => {
    const items = [
      item({ id: 'a', kind: 'movie' }),
      item({ id: 'b', kind: 'tv' }),
    ];

    const result = filterAndSortItems(items, { ...DEFAULT_LIBRARY_FILTERS, kind: 'tv' });

    expect(result.map((i) => i.id)).toEqual(['b']);
  });

  it('filters by search text across title, originalTitle and titleUk (case-insensitive)', () => {
    const items = [
      item({ id: 'a', title: 'Dune' }),
      item({ id: 'b', title: 'Foo', originalTitle: 'The Dune Bar' }),
      item({ id: 'c', title: 'Bar', titleUk: 'Дюна' }),
      item({ id: 'd', title: 'Unrelated' }),
    ];

    const result = filterAndSortItems(items, { ...DEFAULT_LIBRARY_FILTERS, search: 'dune' });

    expect(result.map((i) => i.id).sort()).toEqual(['a', 'b']);
  });

  it('combines status, kind and search filters', () => {
    const items = [
      item({ id: 'a', status: 'watching', kind: 'tv', title: 'Severance' }),
      item({ id: 'b', status: 'watching', kind: 'movie', title: 'Severance the movie' }),
      item({ id: 'c', status: 'want', kind: 'tv', title: 'Severance' }),
    ];

    const result = filterAndSortItems(items, {
      ...DEFAULT_LIBRARY_FILTERS,
      status: 'watching',
      kind: 'tv',
      search: 'sever',
    });

    expect(result.map((i) => i.id)).toEqual(['a']);
  });

  it('sorts by title alphabetically', () => {
    const items = [item({ id: 'a', title: 'Banana' }), item({ id: 'b', title: 'Apple' })];

    const result = filterAndSortItems(items, { ...DEFAULT_LIBRARY_FILTERS, sort: 'title' });

    expect(result.map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('sorts by year descending, treating missing year as oldest', () => {
    const items = [
      item({ id: 'a', year: 2010 }),
      item({ id: 'b', year: 2020 }),
      item({ id: 'c' }),
    ];

    const result = filterAndSortItems(items, { ...DEFAULT_LIBRARY_FILTERS, sort: 'year' });

    expect(result.map((i) => i.id)).toEqual(['b', 'a', 'c']);
  });

  it('filters by favoriteOnly', () => {
    const items = [
      item({ id: 'a', favorite: true }),
      item({ id: 'b', favorite: false }),
      item({ id: 'c' }),
    ];

    const result = filterAndSortItems(items, { ...DEFAULT_LIBRARY_FILTERS, favoriteOnly: true });

    expect(result.map((i) => i.id)).toEqual(['a']);
  });

  it('sorts by my rating descending, treating unrated as lowest', () => {
    const items = [
      item({ id: 'a', myRating: 6 }),
      item({ id: 'b', myRating: 9 }),
      item({ id: 'c' }),
    ];

    const result = filterAndSortItems(items, { ...DEFAULT_LIBRARY_FILTERS, sort: 'rating' });

    expect(result.map((i) => i.id)).toEqual(['b', 'a', 'c']);
  });
});
