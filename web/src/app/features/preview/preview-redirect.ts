import type { MediaItem, MediaKind } from '../../core/models/media-item.model';

/** Id айтема бібліотеки, що вже відповідає цьому kind+tmdbId — якщо є, превью не показуємо (Step 13). */
export function findExistingItemId(items: MediaItem[], kind: MediaKind, tmdbId: number): string | undefined {
  return items.find((item) => item.kind === kind && item.tmdbId === tmdbId)?.id;
}
