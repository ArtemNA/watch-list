// Адаптер MediaList/DerivedList → ShareSource (core/share/share-payload.ts).
// Живе в features/lists/ (не в core/), бо DerivedList — feature-специфічний тип
// (ARCHITECTURE §9: похідні списки теж можна шерити, тим самим payload).

import { entryFromItem } from '../../core/data/list-entry';
import type { I18nService } from '../../core/i18n/i18n.service';
import type { ShareSource } from '../../core/share/share-payload';
import type { MediaList } from '../../core/models/media-list.model';
import type { DerivedList } from './derived-lists';

export function shareSourceFromList(list: MediaList): ShareSource {
  return { name: list.name, entries: list.entries };
}

export function shareSourceFromDerived(list: DerivedList, i18n: I18nService): ShareSource {
  return {
    name: i18n.t(list.titleKey),
    entries: list.items.map((item) => ({ ...entryFromItem(item), addedAt: item.createdAt })),
  };
}
