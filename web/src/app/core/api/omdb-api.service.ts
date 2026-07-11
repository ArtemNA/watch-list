import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';

import type { ExternalRatings } from '../models/media-item.model';

export interface OmdbRating {
  Source: string;
  Value: string;
}

export interface OmdbResponse {
  imdbRating?: string;
  Ratings?: OmdbRating[];
  Response?: string;
  Error?: string;
}

const IMDB_SOURCE = 'Internet Movie Database';
const ROTTEN_TOMATOES_SOURCE = 'Rotten Tomatoes';
const METACRITIC_SOURCE = 'Metacritic';

function parseLeadingNumber(value: string | undefined): number | undefined {
  if (!value || value === 'N/A') {
    return undefined;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** OMDb Ratings[] → знімок рейтингів айтема. Джерела без даних просто відсутні в результаті. */
export function mapOmdbToExternalRatings(response: OmdbResponse): ExternalRatings {
  const ratings: ExternalRatings = {};

  for (const rating of response.Ratings ?? []) {
    if (rating.Value === 'N/A') {
      continue;
    }
    if (rating.Source === IMDB_SOURCE) {
      ratings.imdb = parseLeadingNumber(rating.Value);
    } else if (rating.Source === ROTTEN_TOMATOES_SOURCE) {
      ratings.rottenTomatoes = rating.Value;
    } else if (rating.Source === METACRITIC_SOURCE) {
      ratings.metacritic = parseLeadingNumber(rating.Value);
    }
  }

  return ratings;
}

@Injectable({ providedIn: 'root' })
export class OmdbApiService {
  private readonly http = inject(HttpClient);

  getRatings(imdbId: string): Observable<ExternalRatings> {
    return this.http
      .get<OmdbResponse>('/api/omdb', { params: { i: imdbId } })
      .pipe(map(mapOmdbToExternalRatings));
  }
}
