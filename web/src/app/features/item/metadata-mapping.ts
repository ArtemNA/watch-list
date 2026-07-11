import { mapCommonDetailsFields } from '../../core/api/tmdb-mapping';
import type { TmdbDetails, TmdbWatchProviderItem } from '../../core/api/tmdb-api.service';
import type { Lang } from '../../core/i18n/i18n.service';
import type { ExternalRatings, MediaItem, MediaKind, WatchProviders } from '../../core/models/media-item.model';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const WATCH_PROVIDER_LOGO_BASE_URL = 'https://image.tmdb.org/t/p/w92';
const PREFERRED_REGIONS = ['UA', 'US'];

export type MetadataPatch = Partial<
  Pick<
    MediaItem,
    | 'title'
    | 'originalTitle'
    | 'titleUk'
    | 'year'
    | 'posterUrl'
    | 'overview'
    | 'genres'
    | 'runtime'
    | 'imdbId'
    | 'externalRatings'
    | 'watchProviders'
    | 'metadataLang'
    | 'metadataUpdatedAt'
  >
>;

function mapWatchProviderItems(items: TmdbWatchProviderItem[] | undefined): WatchProviders['flatrate'] {
  if (!items || items.length === 0) {
    return undefined;
  }
  return items
    .slice()
    .sort((a, b) => (a.display_priority ?? 0) - (b.display_priority ?? 0))
    .map((item) => ({
      providerId: item.provider_id,
      providerName: item.provider_name,
      logoUrl: `${WATCH_PROVIDER_LOGO_BASE_URL}${item.logo_path}`,
    }));
}

/** «Де подивитись»: регіон UA, якщо TMDB там нічого не має — fallback US. */
export function extractWatchProviders(details: TmdbDetails): WatchProviders | undefined {
  const regions = details['watch/providers']?.results;
  if (!regions) {
    return undefined;
  }

  const region = PREFERRED_REGIONS.map((code) => regions[code]).find((candidate) => candidate !== undefined);
  if (!region) {
    return undefined;
  }

  const flatrate = mapWatchProviderItems(region.flatrate);
  const rent = mapWatchProviderItems(region.rent);
  const buy = mapWatchProviderItems(region.buy);
  if (!flatrate && !rent && !buy) {
    return undefined;
  }

  return { link: region.link, flatrate, rent, buy };
}

/** TMDB-частина патча збагачення (без OMDb — його додає metadata.service після цього виклику). */
export function mapDetailsToMetadataPatch(details: TmdbDetails, kind: MediaKind, lang: Lang): MetadataPatch {
  const common = mapCommonDetailsFields(details, kind);
  const externalRatings: ExternalRatings | undefined = details.vote_average ? { tmdb: details.vote_average } : undefined;

  return {
    ...common,
    externalRatings,
    watchProviders: extractWatchProviders(details),
    metadataLang: lang,
    metadataUpdatedAt: new Date().toISOString(),
  };
}

/** Чи треба тягнути свіжі метадані при відкритті сторінки айтема (Step 06, задача 3). */
export function shouldRefreshMetadata(item: MediaItem, currentLang: Lang, now: number): boolean {
  if (item.tmdbId === undefined) {
    return false;
  }
  if (!item.metadataUpdatedAt) {
    return true;
  }
  if (item.metadataLang !== currentLang) {
    return true;
  }
  return now - new Date(item.metadataUpdatedAt).getTime() > SEVEN_DAYS_MS;
}
