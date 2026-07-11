import type { MediaItem } from '../models/media-item.model';

// Вакуум tombstones (Step 09, задача 6). Чиста функція — max тестів, ніякого Dexie.
export const TOMBSTONE_TTL_DAYS = 90;

/**
 * Кандидати на фізичне видалення: tombstone старший за 90 днів, і ЩЕ
 * (синкнутий — lastSyncAt новіший за deletedAt, тобто хмара точно вже бачила
 * це видалення) АБО юзер ніколи не логінився (синкати нема з ким — локальний
 * tombstone більше нема сенсу тримати).
 */
export function selectVacuumableTombstones(
  items: MediaItem[],
  nowIso: string,
  lastSyncAt: string | null,
  everLoggedIn: boolean,
): MediaItem[] {
  const cutoff = new Date(new Date(nowIso).getTime() - TOMBSTONE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  return items.filter((item) => {
    if (!item.deletedAt || item.deletedAt > cutoff) {
      return false;
    }
    const confirmedSynced = lastSyncAt !== null && lastSyncAt > item.deletedAt;
    return confirmedSynced || !everLoggedIn;
  });
}
