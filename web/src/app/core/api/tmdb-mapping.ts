import type { MediaKind } from '../models/media-item.model';
import type { TmdbDetails } from './tmdb-api.service';

export const TMDB_POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w342';

export interface TmdbCommonFields {
  title: string;
  originalTitle?: string;
  titleUk?: string;
  year?: number;
  posterUrl?: string;
  overview?: string;
  genres?: string[];
  runtime?: number;
  imdbId?: string;
}

export function parseYear(date: string | undefined): number | undefined {
  if (!date) {
    return undefined;
  }
  const year = Number(date.slice(0, 4));
  return Number.isFinite(year) && year > 0 ? year : undefined;
}

export function posterUrlFor(path: string | null | undefined): string | undefined {
  return path ? `${TMDB_POSTER_BASE_URL}${path}` : undefined;
}

/** Поля деталей TMDB, спільні для створення айтема (search-mapping) і для оновлення метаданих (metadata-mapping). */
export function mapCommonDetailsFields(details: TmdbDetails, kind: MediaKind): TmdbCommonFields {
  const title = (kind === 'movie' ? details.title : details.name) || details.original_title || details.original_name || '';
  const originalTitle = kind === 'movie' ? details.original_title : details.original_name;
  const releaseDate = kind === 'movie' ? details.release_date : details.first_air_date;
  const runtime = kind === 'movie' ? details.runtime : details.episode_run_time?.[0];
  const ukTranslation = details.translations?.translations.find((t) => t.iso_639_1 === 'uk')?.data;
  const titleUk = kind === 'movie' ? ukTranslation?.title : ukTranslation?.name;

  return {
    title,
    originalTitle: originalTitle || undefined,
    titleUk: titleUk || undefined,
    year: parseYear(releaseDate),
    posterUrl: posterUrlFor(details.poster_path),
    overview: details.overview || undefined,
    genres: details.genres?.map((genre) => genre.name),
    runtime: runtime || undefined,
    imdbId: details.external_ids?.imdb_id ?? undefined,
  };
}
