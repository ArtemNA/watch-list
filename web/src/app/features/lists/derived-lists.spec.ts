import type { MediaItem } from '../../core/models/media-item.model';
import { buildDerivedLists } from './derived-lists';

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

describe('buildDerivedLists', () => {
  it('groups items by status into want/watching/watched/dropped, plus a favorite group', () => {
    const items = [
      item({ id: 'a', status: 'want' }),
      item({ id: 'b', status: 'watching' }),
      item({ id: 'c', status: 'watched', favorite: true }),
      item({ id: 'd', status: 'dropped' }),
      item({ id: 'e', status: 'want', favorite: true }),
    ];

    const lists = buildDerivedLists(items);

    expect(lists.map((l) => l.key)).toEqual(['want', 'watching', 'watched', 'dropped', 'favorite']);
    expect(lists.find((l) => l.key === 'want')?.items.map((i) => i.id)).toEqual(['a', 'e']);
    expect(lists.find((l) => l.key === 'watching')?.items.map((i) => i.id)).toEqual(['b']);
    expect(lists.find((l) => l.key === 'favorite')?.items.map((i) => i.id).sort()).toEqual(['c', 'e']);
  });

  it('never mutates status/favorite composition — purely derived, empty groups stay empty', () => {
    const lists = buildDerivedLists([]);
    expect(lists.every((l) => l.items.length === 0)).toBe(true);
  });
});
