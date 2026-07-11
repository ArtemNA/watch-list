import { mapCommonDetailsFields, parseYear, posterUrlFor } from '../../core/api/tmdb-mapping';
import { isFallbackLanguage, languageForUi } from '../../core/api/tmdb-language';
import type { TmdbDetails, TmdbSearchItem } from '../../core/api/tmdb-api.service';
import type { NewMediaItemInput } from '../../core/data/items.repository';
import type { Lang } from '../../core/i18n/i18n.service';
import type { MediaStatus } from '../../core/models/media-item.model';

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

export { isFallbackLanguage, languageForUi };

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

/**
 * Мапить деталі TMDB у вхід репозиторію. `status` за замовчуванням 'want', але викликач
 * може передати інший (Step 06, задача 0б: split-кнопка «Додати як…» на картці пошуку).
 * `metadataUpdatedAt` свідомо НЕ проставляється тут — OMDb-рейтинги і watch-providers ще не
 * тягнуті, а виставлення "щойно оновлено" заблокувало б автооновлення на сторінці айтема
 * (metadata.service, Step 06 задача 3) аж на 7 днів. Перший відкритий item-page сам
 * довантажить решту й тоді проставить мітку.
 */
export function mapDetailsToNewItem(
  details: TmdbDetails,
  kind: SearchKind,
  lang: Lang,
  status: MediaStatus = 'want',
): NewMediaItemInput {
  const common = mapCommonDetailsFields(details, kind);

  return {
    kind,
    status,
    tmdbId: details.id,
    ...common,
    externalRatings: details.vote_average ? { tmdb: details.vote_average } : undefined,
    metadataLang: lang,
  };
}
