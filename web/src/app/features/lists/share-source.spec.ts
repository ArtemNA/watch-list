import type { MediaItem } from '../../core/models/media-item.model';
import type { MediaList } from '../../core/models/media-list.model';
import type { I18nService } from '../../core/i18n/i18n.service';
import type { DerivedList } from './derived-lists';
import { shareSourceFromDerived, shareSourceFromList } from './share-source';

function item(overrides: Partial<MediaItem> = {}): MediaItem {
  return {
    id: 'item-1',
    kind: 'movie',
    status: 'watched',
    title: 'Dune',
    tmdbId: 438631,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    links: [],
    ...overrides,
  };
}

describe('shareSourceFromList', () => {
  it('passes the list name and entries through unchanged', () => {
    const list: MediaList = {
      id: 'list-1',
      name: 'Horror',
      entries: [{ id: 'e1', kind: 'movie', snapshot: { title: 'X' }, addedAt: '2026-01-01T00:00:00.000Z' }],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(shareSourceFromList(list)).toEqual({ name: 'Horror', entries: list.entries });
  });
});

describe('shareSourceFromDerived', () => {
  it('translates titleKey via i18n and converts items to entries with id === item.id (resolves by id/tmdbId later)', () => {
    const derived: DerivedList = { key: 'watched', titleKey: 'status.watched', items: [item()] };
    const i18n = { t: (key: string) => (key === 'status.watched' ? 'Watched' : key) } as I18nService;

    const result = shareSourceFromDerived(derived, i18n);

    expect(result.name).toBe('Watched');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].id).toBe('item-1');
    expect(result.entries[0].tmdbId).toBe(438631);
    expect(result.entries[0].snapshot.title).toBe('Dune');
  });
});
