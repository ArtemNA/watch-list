import type { TmdbDetails, TmdbSearchItem } from '../../core/api/tmdb-api.service';
import type { NewMediaItemInput } from '../../core/data/items.repository';
import type { Lang } from '../../core/i18n/i18n.service';

const FALLBACK_LANGUAGE = 'en-US';
const POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w342';

export type SearchKind = 'movie' | 'tv';

export interface SearchResult {
  id: number;
  kind: SearchKind;
  title: string;
  originalTitle?: string;
  year?: number;
  posterUrl?: string;
  voteAverage?: number;
  inLibrary: boolean;
  existingItemId?: string;
}

export interface SearchPage {
  items: TmdbSearchItem[];
  page: number;
  totalPages: number;
}

/** Мова TMDB-запиту = поточна мова UI; кирилична розкладка запиту її не змінює. */
export function languageForUi(lang: Lang): string {
  return lang === 'uk' ? 'uk-UA' : FALLBACK_LANGUAGE;
}

export function isFallbackLanguage(language: string): boolean {
  return language === FALLBACK_LANGUAGE;
}

/** Лишає тільки movie/tv, дедуплікує за (media_type, id), зберігає порядок TMDB. */
export function dedupeSearchItems(items: TmdbSearchItem[]): TmdbSearchItem[] {
  const seen = new Set<string>();
  const result: TmdbSearchItem[] = [];
  for (const item of items) {
    if (item.media_type !== 'movie' && item.media_type !== 'tv') {
      continue;
    }
    const key = `${item.media_type}:${item.id}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }
  return result;
}

/** Дедуплікація нових результатів проти вже накопичених (пагінація «Показати ще»). */
export function mergeSearchItems(existing: TmdbSearchItem[], incoming: TmdbSearchItem[]): TmdbSearchItem[] {
  const seen = new Set(existing.map((item) => `${item.media_type}:${item.id}`));
  const merged = [...existing];
  for (const item of incoming) {
    const key = `${item.media_type}:${item.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }
  return merged;
}

function parseYear(date: string | undefined): number | undefined {
  if (!date) {
    return undefined;
  }
  const year = Number(date.slice(0, 4));
  return Number.isFinite(year) && year > 0 ? year : undefined;
}

function posterUrlFor(path: string | null | undefined): string | undefined {
  return path ? `${POSTER_BASE_URL}${path}` : undefined;
}

/** Мапить сирий результат пошуку в картку для UI (без позначки «у бібліотеці» — це реактивна частина сервісу). */
export function mapSearchItem(item: TmdbSearchItem): Omit<SearchResult, 'inLibrary' | 'existingItemId'> {
  const kind = item.media_type as SearchKind;
  const title = kind === 'movie' ? item.title : item.name;
  const originalTitle = kind === 'movie' ? item.original_title : item.original_name;
  const releaseDate = kind === 'movie' ? item.release_date : item.first_air_date;

  return {
    id: item.id,
    kind,
    title: title || originalTitle || '',
    originalTitle: originalTitle && originalTitle !== title ? originalTitle : undefined,
    year: parseYear(releaseDate),
    posterUrl: posterUrlFor(item.poster_path),
    voteAverage: item.vote_average,
  };
}

/** Мапить деталі TMDB у вхід репозиторію — статус завжди 'want' (Крок 05 не чіпає інші статуси). */
export function mapDetailsToNewItem(details: TmdbDetails, kind: SearchKind): NewMediaItemInput {
  const title = (kind === 'movie' ? details.title : details.name) || details.original_title || details.original_name || '';
  const originalTitle = kind === 'movie' ? details.original_title : details.original_name;
  const releaseDate = kind === 'movie' ? details.release_date : details.first_air_date;
  const runtime = kind === 'movie' ? details.runtime : details.episode_run_time?.[0];
  const ukTranslation = details.translations?.translations.find((t) => t.iso_639_1 === 'uk')?.data;
  const titleUk = kind === 'movie' ? ukTranslation?.title : ukTranslation?.name;

  return {
    kind,
    status: 'want',
    tmdbId: details.id,
    imdbId: details.external_ids?.imdb_id ?? undefined,
    title,
    originalTitle: originalTitle || undefined,
    titleUk: titleUk || undefined,
    year: parseYear(releaseDate),
    posterUrl: posterUrlFor(details.poster_path),
    overview: details.overview || undefined,
    genres: details.genres?.map((genre) => genre.name),
    runtime: runtime || undefined,
    externalRatings: details.vote_average ? { tmdb: details.vote_average } : undefined,
    metadataUpdatedAt: new Date().toISOString(),
  };
}
