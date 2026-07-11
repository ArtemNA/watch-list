import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { OmdbApiService } from '../../core/api/omdb-api.service';
import { TmdbApiService } from '../../core/api/tmdb-api.service';
import { languageForUi } from '../../core/api/tmdb-language';
import { ItemsRepository } from '../../core/data/items.repository';
import { I18nService } from '../../core/i18n/i18n.service';
import type { MediaItem } from '../../core/models/media-item.model';
import { mapDetailsToMetadataPatch, shouldRefreshMetadata } from './metadata-mapping';

/**
 * Оркестратор збагачення сторінки айтема: TMDB (title/overview/genres/watch-providers)
 * + OMDb (imdb/RT/Metacritic) по imdbId. Помилки OMDb — тихі (лишає TMDB-частину
 * патча); помилка TMDB прокидається виклику, щоб item-page показав снекбар
 * і лишив сторінку на кеші (Step 06, задача 3).
 */
@Injectable({ providedIn: 'root' })
export class MetadataService {
  private readonly tmdbApi = inject(TmdbApiService);
  private readonly omdbApi = inject(OmdbApiService);
  private readonly repo = inject(ItemsRepository);
  private readonly i18n = inject(I18nService);

  shouldRefresh(item: MediaItem): boolean {
    return shouldRefreshMetadata(item, this.i18n.lang(), Date.now());
  }

  async refresh(item: MediaItem): Promise<void> {
    if (item.tmdbId === undefined) {
      return;
    }

    const lang = this.i18n.lang();
    const details = await firstValueFrom(this.tmdbApi.getDetails(item.kind, item.tmdbId, languageForUi(lang)));
    const patch = mapDetailsToMetadataPatch(details, item.kind, lang);

    const imdbId = patch.imdbId ?? item.imdbId;
    if (imdbId) {
      try {
        const omdbRatings = await firstValueFrom(this.omdbApi.getRatings(imdbId));
        patch.externalRatings = { ...patch.externalRatings, ...omdbRatings };
      } catch {
        // OMDb недоступний/ключ вичерпано — лишаємо TMDB-рейтинг, сторінка далі працює з кешу.
      }
    }

    await this.repo.update(item.id, patch);
  }
}
