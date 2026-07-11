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
    createdAt: item['createdAt'] as string,
    updatedAt: item['updatedAt'] as string,
    deletedAt: deletedAt === undefined ? undefined : (deletedAt as string | null),
  };
}
