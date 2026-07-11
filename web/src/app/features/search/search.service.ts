import { Injectable, computed, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { TmdbSearchItem } from '../../core/api/tmdb-api.service';
import { TmdbApiService } from '../../core/api/tmdb-api.service';
import { ItemsRepository } from '../../core/data/items.repository';
import { I18nService } from '../../core/i18n/i18n.service';
import type { MediaItem } from '../../core/models/media-item.model';
import {
  dedupeSearchItems,
  isFallbackLanguage,
  languageForUi,
  mapDetailsToNewItem,
  mapSearchItem,
  type SearchPage,
  type SearchResult,
} from './search-mapping';

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly tmdbApi = inject(TmdbApiService);
  private readonly repo = inject(ItemsRepository);
  private readonly i18n = inject(I18nService);

  /** tmdbId -> id локального айтема, для позначки «У бібліотеці» без повторного фетчу. */
  readonly libraryTmdbIds = computed(() => {
    const map = new Map<number, string>();
    for (const item of this.repo.items()) {
      if (item.tmdbId !== undefined) {
        map.set(item.tmdbId, item.id);
      }
    }
    return map;
  });

  /** Запит з мовою UI; якщо 0 результатів — fallback на en-US. */
  async fetchResults(query: string, page = 1): Promise<SearchPage> {
    const primaryLanguage = languageForUi(this.i18n.lang());
    let response = await firstValueFrom(this.tmdbApi.searchMulti(query, primaryLanguage, page));
    if (response.results.length === 0 && !isFallbackLanguage(primaryLanguage)) {
      response = await firstValueFrom(this.tmdbApi.searchMulti(query, 'en-US', page));
    }
    return {
      items: dedupeSearchItems(response.results),
      page: response.page,
      totalPages: response.total_pages,
    };
  }

  toResultView(item: TmdbSearchItem): SearchResult {
    const existingItemId = this.libraryTmdbIds().get(item.id);
    return { ...mapSearchItem(item), inLibrary: existingItemId !== undefined, existingItemId };
  }

  async addToLibrary(result: SearchResult): Promise<{ mediaItem: MediaItem; alreadyExists: boolean }> {
    const existingId = this.libraryTmdbIds().get(result.id);
    if (existingId) {
      const existing = await this.repo.getById(existingId);
      if (existing) {
        return { mediaItem: existing, alreadyExists: true };
      }
    }

    const details = await firstValueFrom(this.tmdbApi.getDetails(result.kind, result.id));
    const mediaItem = await this.repo.add(mapDetailsToNewItem(details, result.kind));
    return { mediaItem, alreadyExists: false };
  }
}
