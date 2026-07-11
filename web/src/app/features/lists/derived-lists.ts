import type { MediaItem, MediaStatus } from '../../core/models/media-item.model';

// Похідні списки (ARCHITECTURE §9): обчислюються з items, НЕ зберігаються і
// НЕ редагуються — склад визначається виключно статусом/прапорцем айтема.

export type DerivedListKey = MediaStatus | 'favorite';

export interface DerivedList {
  key: DerivedListKey;
  titleKey: string; // i18n ключ назви
  items: MediaItem[];
}

const STATUS_KEYS: MediaStatus[] = ['want', 'watching', 'watched', 'dropped'];

/** Чиста функція — групує items у похідні списки за статусом + улюблене. */
export function buildDerivedLists(items: MediaItem[]): DerivedList[] {
  const statusLists = STATUS_KEYS.map<DerivedList>((status) => ({
    key: status,
    titleKey: `status.${status}`,
    items: items.filter((item) => item.status === status),
  }));

  const favoriteList: DerivedList = {
    key: 'favorite',
    titleKey: 'lists.derived.favorite',
    items: items.filter((item) => !!item.favorite),
  };

  return [...statusLists, favoriteList];
}
