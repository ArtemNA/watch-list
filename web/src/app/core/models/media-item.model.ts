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
  metadataUpdatedAt?: string; // ISO; коли востаннє тягнули з API

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
