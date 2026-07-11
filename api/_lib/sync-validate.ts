// Валідація айтемів синку. Форма дублює MediaItem з web/ свідомо:
// api/ не імпортує з web/ (окремі tsconfig/збірки), а спільний пакет для
// одного інтерфейсу — зайва інфраструктура. Джерело правди — ARCHITECTURE.md §2.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = new Set(['movie', 'tv']);
const STATUSES = new Set(['want', 'watching', 'watched', 'dropped']);
const LANGS = new Set(['uk', 'en', 'ru']);
const MAX_STRING = 20_000; // нотатки; решта рядків значно коротші
const MAX_LINKS = 100;

export interface SyncLink {
  id: string;
  label: string;
  url: string;
}

export interface SyncItem {
  id: string;
  kind: string;
  status: string;
  tmdbId?: number;
  imdbId?: string;
  title: string;
  originalTitle?: string;
  titleUk?: string;
  year?: number;
  posterUrl?: string;
  overview?: string;
  genres?: string[];
  runtime?: number;
  externalRatings?: { tmdb?: number; imdb?: number; rottenTomatoes?: string; metacritic?: number };
  watchProviders?: unknown;
  metadataUpdatedAt?: string;
  metadataLang?: string;
  myRating?: number;
  notes?: string;
  links: SyncLink[];
  watchedAt?: string;
  favorite?: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

function isIso(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 10 && !Number.isNaN(Date.parse(value));
}

function optString(value: unknown, max = MAX_STRING): string | undefined {
  return typeof value === 'string' && value.length <= max ? value : undefined;
}

function optNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function sanitizeLinks(value: unknown): SyncLink[] | null {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.length > MAX_LINKS) {
    return null;
  }
  const links: SyncLink[] = [];
  for (const raw of value) {
    const link = raw as { id?: unknown; label?: unknown; url?: unknown };
    const id = optString(link?.id, 100);
    const label = optString(link?.label, 500);
    const url = optString(link?.url, 2000);
    if (!id || label === undefined || url === undefined) {
      return null;
    }
    links.push({ id, label, url });
  }
  return links;
}

/**
 * Перевіряє і САНІТИЗУЄ айтем: повертає об'єкт лише з відомих полів
 * (зайві поля з клієнта не потрапляють у Mongo) або null, якщо айтем невалідний.
 */
export function sanitizeSyncItem(raw: unknown): SyncItem | null {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const item = raw as Record<string, unknown>;

  if (typeof item['id'] !== 'string' || !UUID_RE.test(item['id'])) {
    return null;
  }
  if (typeof item['kind'] !== 'string' || !KINDS.has(item['kind'])) {
    return null;
  }
  if (typeof item['status'] !== 'string' || !STATUSES.has(item['status'])) {
    return null;
  }
  if (typeof item['title'] !== 'string' || item['title'].length > 1000) {
    return null;
  }
  if (!isIso(item['createdAt']) || !isIso(item['updatedAt'])) {
    return null;
  }
  const deletedAt = item['deletedAt'];
  if (deletedAt !== undefined && deletedAt !== null && !isIso(deletedAt)) {
    return null;
  }
  const links = sanitizeLinks(item['links']);
  if (links === null) {
    return null;
  }
  const myRating = optNumber(item['myRating']);
  if (myRating !== undefined && (myRating < 1 || myRating > 10)) {
    return null;
  }

  const ratings = item['externalRatings'] as Record<string, unknown> | undefined;
  const genres = Array.isArray(item['genres'])
    ? item['genres'].filter((g): g is string => typeof g === 'string').slice(0, 50)
    : undefined;

  return {
    id: item['id'],
    kind: item['kind'],
    status: item['status'],
    tmdbId: optNumber(item['tmdbId']),
    imdbId: optString(item['imdbId'], 20),
    title: item['title'],
    originalTitle: optString(item['originalTitle'], 1000),
    titleUk: optString(item['titleUk'], 1000),
    year: optNumber(item['year']),
    posterUrl: optString(item['posterUrl'], 2000),
    overview: optString(item['overview']),
    genres,
    runtime: optNumber(item['runtime']),
    externalRatings:
      ratings && typeof ratings === 'object'
        ? {
            tmdb: optNumber(ratings['tmdb']),
            imdb: optNumber(ratings['imdb']),
            rottenTomatoes: optString(ratings['rottenTomatoes'], 20),
            metacritic: optNumber(ratings['metacritic']),
          }
        : undefined,
    // watchProviders — кеш TMDB, структуру не дублюємо; обмежуємо лише розмір.
    watchProviders:
      item['watchProviders'] && JSON.stringify(item['watchProviders']).length <= MAX_STRING
        ? item['watchProviders']
        : undefined,
    metadataUpdatedAt: isIso(item['metadataUpdatedAt']) ? (item['metadataUpdatedAt'] as string) : undefined,
    metadataLang:
      typeof item['metadataLang'] === 'string' && LANGS.has(item['metadataLang'])
        ? item['metadataLang']
        : undefined,
    myRating,
    notes: optString(item['notes']),
    links,
    watchedAt: optString(item['watchedAt'], 40),
    // false нормалізується в undefined (та сама семантика «не улюблене») —
    // ВАЖЛИВО не забувати нові поля тут: санітизація мовчки стирала favorite
    // при push, і наступний pull знищував улюблене на всіх пристроях
    // (знайдено живим ревью Step 11).
    favorite: item['favorite'] === true ? true : undefined,
    createdAt: item['createdAt'] as string,
    updatedAt: item['updatedAt'] as string,
    deletedAt: deletedAt === undefined ? undefined : (deletedAt as string | null),
  };
}

// --- lists (Step 11) — ARCHITECTURE §9. Форма дублює MediaList/ListEntry з
// web/ так само свідомо, як SyncItem вище дублює MediaItem.

const MAX_NAME = 300;
const MAX_ENTRIES = 5000;

export interface SyncListEntrySnapshot {
  title: string;
  originalTitle?: string;
  year?: number;
  posterUrl?: string;
}

export interface SyncListEntry {
  id: string;
  kind: string;
  tmdbId?: number;
  imdbId?: string;
  snapshot: SyncListEntrySnapshot;
  sharedNotes?: string;
  sharedLinks?: SyncLink[];
  addedAt: string;
}

export interface SyncListOrigin {
  sharedBy: string;
  sharedAt: string;
}

export interface SyncList {
  id: string;
  name: string;
  description?: string;
  origin?: SyncListOrigin;
  entries: SyncListEntry[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

function sanitizeSnapshot(value: unknown): SyncListEntrySnapshot | null {
  if (value === null || typeof value !== 'object') {
    return null;
  }
  const snapshot = value as Record<string, unknown>;
  const title = optString(snapshot['title'], 1000);
  if (title === undefined) {
    return null;
  }
  return {
    title,
    originalTitle: optString(snapshot['originalTitle'], 1000),
    year: optNumber(snapshot['year']),
    posterUrl: optString(snapshot['posterUrl'], 2000),
  };
}

/**
 * На відміну від links (обов'язкове поле айтема), sharedLinks — опційне.
 * `null` трактуємо як «відсутнє» (не як невалідне!): драйвер Mongo зберігає
 * undefined-поля як null, тож пул повертає `sharedLinks: null` — і повторний
 * push такого списку інакше відхилявся б (ламало re-sync списків з entries;
 * знайдено живим ревью Step 11).
 */
function sanitizeOptionalLinks(value: unknown): SyncLink[] | null | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return sanitizeLinks(value);
}

function sanitizeOrigin(value: unknown): SyncListOrigin | null | undefined {
  // null === «відсутнє» (Mongo round-trip undefined→null; див. sanitizeOptionalLinks).
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'object') {
    return null;
  }
  const origin = value as Record<string, unknown>;
  const sharedBy = optString(origin['sharedBy'], 200);
  if (sharedBy === undefined || !isIso(origin['sharedAt'])) {
    return null;
  }
  return { sharedBy, sharedAt: origin['sharedAt'] as string };
}

function sanitizeListEntry(raw: unknown): SyncListEntry | null {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const entry = raw as Record<string, unknown>;

  const id = optString(entry['id'], 100);
  if (!id) {
    return null;
  }
  if (typeof entry['kind'] !== 'string' || !KINDS.has(entry['kind'])) {
    return null;
  }
  const snapshot = sanitizeSnapshot(entry['snapshot']);
  if (!snapshot) {
    return null;
  }
  if (!isIso(entry['addedAt'])) {
    return null;
  }
  const sharedLinks = sanitizeOptionalLinks(entry['sharedLinks']);
  if (sharedLinks === null) {
    return null;
  }

  return {
    id,
    kind: entry['kind'],
    tmdbId: optNumber(entry['tmdbId']),
    imdbId: optString(entry['imdbId'], 20),
    snapshot,
    sharedNotes: optString(entry['sharedNotes']),
    sharedLinks,
    addedAt: entry['addedAt'] as string,
  };
}

/** Перевіряє і санітизує список (як sanitizeSyncItem — лише відомі поля, null якщо невалідний). */
export function sanitizeSyncList(raw: unknown): SyncList | null {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const list = raw as Record<string, unknown>;

  if (typeof list['id'] !== 'string' || !UUID_RE.test(list['id'])) {
    return null;
  }
  if (typeof list['name'] !== 'string' || list['name'].length > MAX_NAME) {
    return null;
  }
  if (!isIso(list['createdAt']) || !isIso(list['updatedAt'])) {
    return null;
  }
  const deletedAt = list['deletedAt'];
  if (deletedAt !== undefined && deletedAt !== null && !isIso(deletedAt)) {
    return null;
  }
  if (!Array.isArray(list['entries']) || list['entries'].length > MAX_ENTRIES) {
    return null;
  }

  const entries: SyncListEntry[] = [];
  for (const rawEntry of list['entries']) {
    const entry = sanitizeListEntry(rawEntry);
    if (!entry) {
      return null;
    }
    entries.push(entry);
  }

  const origin = sanitizeOrigin(list['origin']);
  if (origin === null) {
    return null;
  }

  return {
    id: list['id'],
    name: list['name'],
    description: optString(list['description'], 5000),
    origin,
    entries,
    createdAt: list['createdAt'] as string,
    updatedAt: list['updatedAt'] as string,
    deletedAt: deletedAt === undefined ? undefined : (deletedAt as string | null),
  };
}
