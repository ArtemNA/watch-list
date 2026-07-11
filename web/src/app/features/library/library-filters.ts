import type { MediaItem, MediaKind, MediaStatus } from '../../core/models/media-item.model';

export type StatusFilter = MediaStatus | 'all';
export type KindFilter = MediaKind | 'all';
export type LibrarySort = 'addedDesc' | 'title' | 'year' | 'rating';

export interface LibraryFilters {
  status: StatusFilter;
  kind: KindFilter;
  search: string;
  sort: LibrarySort;
  favoriteOnly: boolean;
}

export const DEFAULT_LIBRARY_FILTERS: LibraryFilters = {
  status: 'all',
  kind: 'all',
  search: '',
  sort: 'addedDesc',
  favoriteOnly: false,
};

/** Чиста функція фільтрації + сортування бібліотеки — винесена для юніт-тестів. */
export function filterAndSortItems(items: MediaItem[], filters: LibraryFilters): MediaItem[] {
  const search = filters.search.trim().toLowerCase();

  const filtered = items.filter((item) => {
    if (filters.status !== 'all' && item.status !== filters.status) {
      return false;
    }
    if (filters.kind !== 'all' && item.kind !== filters.kind) {
      return false;
    }
    if (filters.favoriteOnly && !item.favorite) {
      return false;
    }
    if (search && !matchesSearch(item, search)) {
      return false;
    }
    return true;
  });

  return filtered.sort((a, b) => compareItems(a, b, filters.sort));
}

function matchesSearch(item: MediaItem, search: string): boolean {
  return [item.title, item.originalTitle, item.titleUk].some((title) =>
    title?.toLowerCase().includes(search),
  );
}

function compareItems(a: MediaItem, b: MediaItem, sort: LibrarySort): number {
  switch (sort) {
    case 'title':
      return a.title.localeCompare(b.title);
    case 'year':
      return (b.year ?? 0) - (a.year ?? 0);
    case 'rating':
      return (b.myRating ?? 0) - (a.myRating ?? 0);
    case 'addedDesc':
      return b.createdAt.localeCompare(a.createdAt);
  }
}
