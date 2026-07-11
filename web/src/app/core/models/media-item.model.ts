export type MediaKind = 'movie' | 'tv';
export type MediaStatus = 'want' | 'watching' | 'watched' | 'dropped';

export interface CustomLink {
  id: string;
  label: string;
  url: string;
}

export interface ExternalRatings {
  tmdb?: number;
  imdb?: number;
  rottenTomatoes?: string;
  metacritic?: number;
}

export type MetadataLang = 'uk' | 'en';

export interface WatchProviderItem {
  providerId: number;
  providerName: string;
  logoUrl: string;
}

// Дані по регіону (UA, fallback US) з TMDB watch/providers — не в ARCHITECTURE §2,
// додано в Step 06: без цього поля "де подивитись" довелось би бити в API щоразу,
// бо офлайн-кеш айтема не мав би звідки їх узяти (задокументовано в step-06.md).
export interface WatchProviders {
  link?: string; // deep-лінк TMDB (обов'язкова атрибуція JustWatch у UI)
  flatrate?: WatchProviderItem[];
  rent?: WatchProviderItem[];
  buy?: WatchProviderItem[];
}

export interface MediaItem {
  id: string; // uuid v4, генерується на клієнті — ключ синку
  kind: MediaKind;
  status: MediaStatus;

  // Ідентифікатори зовнішніх API (для дедуплікаціі та збагачення)
  tmdbId?: number;
  imdbId?: string; // 'tt1234567' — місток TMDB↔OMDb

  // Кешований знімок метаданих (щоб список працював офлайн)
  title: string; // головна назва для відображення
  originalTitle?: string;
  titleUk?: string; // українська назва, якщо TMDB її має
  year?: number;
  posterUrl?: string; // повний URL TMDB-постера (w342)
  overview?: string;
  genres?: string[];
  runtime?: number; // хв (для tv — епізод)
  externalRatings?: ExternalRatings; // знімок на момент останнього оновлення
  watchProviders?: WatchProviders; // TMDB watch/providers, регіон UA з fallback US
  metadataUpdatedAt?: string; // ISO; коли востаннє тягнули з API (OMDb+providers включно)
  metadataLang?: MetadataLang; // мова, якою кешовано title/overview/genres

  // Мої дані (найцінніше — саме це merge'иться найобережніше)
  myRating?: number; // 1..10
  notes?: string; // plain text / markdown
  links: CustomLink[];
  watchedAt?: string; // ISO-дата коли подивився

  // Службове
  createdAt: string; // ISO
  updatedAt: string; // ISO — оновлюється при БУДЬ-ЯКІЙ зміні; основа синку
  deletedAt?: string | null; // tombstone: видалені не стираються, а позначаються
}
