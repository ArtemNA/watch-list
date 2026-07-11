import { Component, computed, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import { AppButton } from '../../../shared/ui/button/app-button';
import { AppChip } from '../../../shared/ui/chip/app-chip';
import { AppEmptyState } from '../../../shared/ui/empty-state/app-empty-state';
import { AppInput } from '../../../shared/ui/input/app-input';
import type { TmdbSearchItem } from '../../../core/api/tmdb-api.service';
import { mergeSearchItems, type SearchResult } from '../search-mapping';
import { SearchService } from '../search.service';

type SearchStatus = 'idle' | 'loading' | 'error' | 'loadingMore';

const SEARCH_DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 2;

@Component({
  selector: 'app-search-page',
  imports: [RouterLink, TPipe, AppButton, AppChip, AppEmptyState, AppInput],
  templateUrl: './search-page.html',
  styleUrl: './search-page.scss',
})
export class SearchPage {
  private readonly searchService = inject(SearchService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);

  protected readonly queryDraft = signal('');
  protected readonly status = signal<SearchStatus>('idle');
  protected readonly page = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly addingIds = signal<ReadonlySet<number>>(new Set());

  private readonly rawItems = signal<TmdbSearchItem[]>([]);
  protected readonly results = computed<SearchResult[]>(() =>
    this.rawItems().map((item) => this.searchService.toResultView(item)),
  );

  private readonly lastQuery = signal('');
  protected readonly hasSearched = computed(() => this.lastQuery() !== '');
  protected readonly hasMore = computed(() => this.page() < this.totalPages());

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private requestToken = 0;

  onQueryInput(value: string): void {
    this.queryDraft.set(value);
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }

    const trimmed = value.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      this.searchTimer = setTimeout(() => this.reset(), SEARCH_DEBOUNCE_MS);
      return;
    }

    this.searchTimer = setTimeout(() => void this.runSearch(trimmed, 1), SEARCH_DEBOUNCE_MS);
  }

  retry(): void {
    const query = this.lastQuery();
    if (query) {
      void this.runSearch(query, 1);
    }
  }

  loadMore(): void {
    const query = this.lastQuery();
    if (query) {
      void this.runSearch(query, this.page() + 1, true);
    }
  }

  async addItem(result: SearchResult): Promise<void> {
    this.addingIds.update((ids) => new Set(ids).add(result.id));
    try {
      const { mediaItem, alreadyExists } = await this.searchService.addToLibrary(result);
      const messageKey = alreadyExists ? 'search.add.alreadyInLibrary' : 'search.add.success';
      const ref = this.snackBar.open(
        this.i18n.t(messageKey, { title: mediaItem.title }),
        this.i18n.t('search.add.viewAction'),
        { duration: 5000 },
      );
      ref.onAction().subscribe(() => void this.router.navigate(['/item', mediaItem.id]));
    } catch {
      this.snackBar.open(this.i18n.t('search.add.error'), this.i18n.t('common.cancel'), { duration: 5000 });
    } finally {
      this.addingIds.update((ids) => {
        const next = new Set(ids);
        next.delete(result.id);
        return next;
      });
    }
  }

  private reset(): void {
    this.lastQuery.set('');
    this.rawItems.set([]);
    this.status.set('idle');
  }

  private async runSearch(query: string, page: number, append = false): Promise<void> {
    this.lastQuery.set(query);
    this.status.set(append ? 'loadingMore' : 'loading');
    const token = ++this.requestToken;

    try {
      const response = await this.searchService.fetchResults(query, page);
      if (token !== this.requestToken) {
        return;
      }
      this.page.set(response.page);
      this.totalPages.set(response.totalPages);
      this.rawItems.set(append ? mergeSearchItems(this.rawItems(), response.items) : response.items);
      this.status.set('idle');
    } catch {
      if (token !== this.requestToken) {
        return;
      }
      this.status.set('error');
    }
  }
}
