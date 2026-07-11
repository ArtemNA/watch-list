import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type { MediaKind } from '../models/media-item.model';

export interface TmdbSearchItem {
  id: number;
  media_type: 'movie' | 'tv' | 'person';
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  vote_average?: number;
}

export interface TmdbSearchResponse {
  page: number;
  results: TmdbSearchItem[];
  total_pages: number;
  total_results: number;
}

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbExternalIds {
  imdb_id?: string | null;
}

export interface TmdbTranslationData {
  title?: string;
  name?: string;
}

export interface TmdbTranslation {
  iso_639_1: string;
  data: TmdbTranslationData;
}

export interface TmdbTranslations {
  translations: TmdbTranslation[];
}

export interface TmdbDetails {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  overview?: string;
  genres?: TmdbGenre[];
  runtime?: number;
  episode_run_time?: number[];
  vote_average?: number;
  external_ids?: TmdbExternalIds;
  translations?: TmdbTranslations;
}

@Injectable({ providedIn: 'root' })
export class TmdbApiService {
  private readonly http = inject(HttpClient);

  searchMulti(query: string, language: string, page = 1): Observable<TmdbSearchResponse> {
    return this.http.get<TmdbSearchResponse>('/api/tmdb/search/multi', {
      params: { query, language, page, include_adult: false },
    });
  }

  getDetails(kind: MediaKind, id: number): Observable<TmdbDetails> {
    return this.http.get<TmdbDetails>(`/api/tmdb/${kind}/${id}`, {
      params: { append_to_response: 'external_ids,translations' },
    });
  }
}
