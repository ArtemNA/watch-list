import { Injectable, computed, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { TmdbSearchItem } from '../../core/api/tmdb-api.service';
import { TmdbApiService } from '../../core/api/tmdb-api.service';
import { ItemsRepository } from '../../core/data/items.repository';
import { I18nService } from '../../core/i18n/i18n.service';
import type { MediaItem, MediaStatus } from '../../core/models/media-item.model';
import { MetadataService } from '../item/metadata.service';
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
  private readonly metadataService = inject(MetadataService);

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

  async addToLibrary(
    result: SearchResult,
    status: MediaStatus = 'want',
  ): Promise<{ mediaItem: MediaItem; alreadyExists: boolean }> {
    const existingId = this.libraryTmdbIds().get(result.id);
    if (existingId) {
      const existing = await this.repo.getById(existingId);
      if (existing) {
        return { mediaItem: existing, alreadyExists: true };
      }
    }

    const lang = this.i18n.lang();
    const details = await firstValueFrom(this.tmdbApi.getDetails(result.kind, result.id, languageForUi(lang)));
    const mediaItem = await this.repo.add(mapDetailsToNewItem(details, result.kind, lang, status));
    return { mediaItem, alreadyExists: false };
  }

  /** «Зв'язати з TMDB» для ручного айтема (Step 06, задача 5) — оновлює ІСНУЮЧИЙ айтем, нового не створює. */
  async linkToExistingItem(itemId: string, result: SearchResult): Promise<MediaItem> {
    await this.repo.update(itemId, { tmdbId: result.id, kind: result.kind });
    const item = await this.repo.getById(itemId);
    if (!item) {
      throw new Error(`Item ${itemId} not found`);
    }

    await this.metadataService.refresh(item);
    const updated = await this.repo.getById(itemId);
    if (!updated) {
      throw new Error(`Item ${itemId} not found after linking`);
    }
    return updated;
  }
}
