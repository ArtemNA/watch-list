import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { OmdbApiService } from '../../core/api/omdb-api.service';
import { TmdbApiService } from '../../core/api/tmdb-api.service';
import { languageForUi } from '../../core/api/tmdb-language';
import { mapCommonDetailsFields } from '../../core/api/tmdb-mapping';
import type { Lang } from '../../core/i18n/i18n.service';
import type { ExternalRatings, MediaKind, WatchProviders } from '../../core/models/media-item.model';
import { extractWatchProviders } from '../item/metadata-mapping';

export interface PreviewData {
  kind: MediaKind;
  tmdbId: number;
  title: string;
  originalTitle?: string;
  year?: number;
  posterUrl?: string;
  overview?: string;
  genres?: string[];
  imdbId?: string;
  externalRatings?: ExternalRatings;
  watchProviders?: WatchProviders;
}

/**
 * Дані превью фільму/серіалу з TMDB(+OMDb) БЕЗ жодного запису в IndexedDB
 * (Step 13) — превью не «айтем», а вітрина API. Кеш у пам'яті на сесію
 * (Map по `kind:id:lang`), щоб «назад-вперед» з пошуку не бив у API повторно.
 * Провальні запити НЕ кешуються — «Повторити» реально повторює виклик.
 */
@Injectable({ providedIn: 'root' })
export class PreviewService {
  private readonly tmdbApi = inject(TmdbApiService);
  private readonly omdbApi = inject(OmdbApiService);

  private readonly cache = new Map<string, Promise<PreviewData>>();

  load(kind: MediaKind, tmdbId: number, lang: Lang): Promise<PreviewData> {
    const key = `${kind}:${tmdbId}:${lang}`;
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    const request = this.fetch(kind, tmdbId, lang).catch((error: unknown) => {
      this.cache.delete(key);
      throw error;
    });
    this.cache.set(key, request);
    return request;
  }

  private async fetch(kind: MediaKind, tmdbId: number, lang: Lang): Promise<PreviewData> {
    const details = await firstValueFrom(this.tmdbApi.getDetails(kind, tmdbId, languageForUi(lang)));
    const common = mapCommonDetailsFields(details, kind);
    let externalRatings: ExternalRatings | undefined = details.vote_average ? { tmdb: details.vote_average } : undefined;

    if (common.imdbId) {
      try {
        const omdbRatings = await firstValueFrom(this.omdbApi.getRatings(common.imdbId));
        externalRatings = { ...externalRatings, ...omdbRatings };
      } catch {
        // OMDb недоступний/ключ вичерпано — тихо лишаємо TMDB-рейтинг (як на item-page, Step 06).
      }
    }

    return {
      kind,
      tmdbId,
      ...common,
      externalRatings,
      watchProviders: extractWatchProviders(details),
    };
  }
}
