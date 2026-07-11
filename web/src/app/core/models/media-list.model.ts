import type { CustomLink, MediaKind } from './media-item.model';

// Списки і шеринг — ARCHITECTURE.md §9. Списки НЕ змінюють MediaItem (§2):
// членство фільму в списку і його статус — незалежні речі.

export interface ListEntrySnapshot {
  title: string;
  originalTitle?: string;
  year?: number;
  posterUrl?: string;
}

export interface ListEntry {
  // Для entries, доданих із бібліотеки (entryFromItem), id === MediaItem.id —
  // це навмисно, а не uuid запису: саме так резолв списку в бібліотеку (Step 11,
  // задача 6 "fallback: itemId для ручних") працює без окремого поля itemId,
  // якого нема в моделі за ARCHITECTURE §9. Для імпортованих (Step 12) entries
  // без відповідника в бібліотеці id лишається просто унікальним ідентифікатором запису.
  id: string;
  kind: MediaKind;
  tmdbId?: number;
  imdbId?: string;
  snapshot: ListEntrySnapshot;
  sharedNotes?: string;
  sharedLinks?: CustomLink[];
  addedAt: string;
}

export interface MediaListOrigin {
  sharedBy: string;
  sharedAt: string;
}

export interface MediaList {
  id: string; // uuid, клієнтський
  name: string; // НЕ унікальна
  description?: string;
  origin?: MediaListOrigin; // тільки в імпортованих списків (Step 12)
  entries: ListEntry[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null; // tombstone, як у MediaItem
}
