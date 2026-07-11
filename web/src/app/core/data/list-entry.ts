import type { MediaItem } from '../models/media-item.model';
import type { ListEntry } from '../models/media-list.model';

// Чисті хелпери навколо ListEntry (ARCHITECTURE §9) — без Dexie/Angular, для юніт-тестів.

/**
 * Ключ дедуплікації/резолву entry в бібліотеку: `tmdbId`, якщо є (канонічний
 * ідентифікатор), інакше `id` запису. Для entries, доданих із бібліотеки,
 * `id === MediaItem.id` (див. коментар у media-list.model.ts) — тому "id" тут
 * і є "itemId" зі step-11 задачі 6.
 */
export function entryKey(entry: Pick<ListEntry, 'id' | 'tmdbId'>): string {
  return entry.tmdbId !== undefined ? `tmdb:${entry.tmdbId}` : `id:${entry.id}`;
}

/** MediaItem → ListEntry (без addedAt — його ставить репозиторій). */
export function entryFromItem(item: MediaItem): Omit<ListEntry, 'addedAt'> {
  return {
    id: item.id,
    kind: item.kind,
    tmdbId: item.tmdbId,
    imdbId: item.imdbId,
    snapshot: {
      title: item.title,
      originalTitle: item.originalTitle,
      year: item.year,
      posterUrl: item.posterUrl,
    },
  };
}

/**
 * Union двох масивів entries за entryKey (Step 11, синк §9: "автоматичне
 * об'єднання за (tmdbId ?? id) БЕЗ merge-діалогу"). При колізії ключа лишає
 * локальну версію — довільний, але детермінований вибір; побічний ефект:
 * запис, видалений з одного боку, може «воскреснути» — задокументований
 * прийнятний компроміс (ARCHITECTURE §9).
 */
export function mergeEntries(local: ListEntry[], remote: ListEntry[]): ListEntry[] {
  const byKey = new Map<string, ListEntry>();
  for (const entry of local) {
    byKey.set(entryKey(entry), entry);
  }
  for (const entry of remote) {
    const key = entryKey(entry);
    if (!byKey.has(key)) {
      byKey.set(key, entry);
    }
  }
  return [...byKey.values()];
}
