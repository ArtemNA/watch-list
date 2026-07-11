import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ItemsRepository } from '../../../core/data/items.repository';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import type { MediaItem, MediaKind, MediaStatus } from '../../../core/models/media-item.model';
import { AppButton } from '../../../shared/ui/button/app-button';
import { AppChip } from '../../../shared/ui/chip/app-chip';
import { AppEmptyState } from '../../../shared/ui/empty-state/app-empty-state';
import { AppFavoriteToggle } from '../../../shared/ui/favorite-toggle/app-favorite-toggle';
import { AppInput } from '../../../shared/ui/input/app-input';
import { AppRating } from '../../../shared/ui/rating/app-rating';
import { AddItemDialog } from '../add-item-dialog/add-item-dialog';
import type { KindFilter, LibraryFilters, LibrarySort, StatusFilter } from '../library-filters';
import { DEFAULT_LIBRARY_FILTERS, filterAndSortItems } from '../library-filters';

const STATUSES: MediaStatus[] = ['want', 'watching', 'watched', 'dropped'];
const KINDS: MediaKind[] = ['movie', 'tv'];
const SORTS: LibrarySort[] = ['addedDesc', 'title', 'year', 'rating'];
const SEARCH_DEBOUNCE_MS = 300;

function parseStatusFilter(raw: string | null): StatusFilter {
  return raw && (STATUSES as string[]).includes(raw) ? (raw as MediaStatus) : 'all';
}

function parseKindFilter(raw: string | null): KindFilter {
  return raw && (KINDS as string[]).includes(raw) ? (raw as MediaKind) : 'all';
}

function parseSortFilter(raw: string | null): LibrarySort {
  return raw && (SORTS as string[]).includes(raw) ? (raw as LibrarySort) : 'addedDesc';
}

@Component({
  selector: 'app-library-page',
  imports: [RouterLink, TPipe, AppButton, AppChip, AppEmptyState, AppFavoriteToggle, AppInput, AppRating],
  templateUrl: './library-page.html',
  styleUrl: './library-page.scss',
})
export class LibraryPage {
  private readonly repo = inject(ItemsRepository);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  protected readonly i18n = inject(I18nService);

  protected readonly statuses = STATUSES;
  protected readonly kinds = KINDS;
  protected readonly sorts = SORTS;

  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  protected readonly filters = computed<LibraryFilters>(() => {
    const params = this.queryParams();
    return {
      status: parseStatusFilter(params.get('status')),
      kind: parseKindFilter(params.get('kind')),
      search: params.get('q') ?? '',
      sort: parseSortFilter(params.get('sort')),
      favoriteOnly: params.get('fav') === '1',
    };
  });

  protected readonly searchDraft = signal(DEFAULT_LIBRARY_FILTERS.search);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly counts = this.repo.counts;
  protected readonly totalCount = computed(() => this.repo.items().length);
  protected readonly visibleItems = computed(() =>
    filterAndSortItems(this.repo.items(), this.filters()),
  );

  constructor() {
    // Тримає локальний драфт пошуку синхронним, коли фільтри міняються ззовні
    // (back/forward навігація), і не заважає дебаунсу під час набору тексту.
    effect(() => {
      const urlSearch = this.filters().search;
      if (urlSearch !== untracked(this.searchDraft)) {
        this.searchDraft.set(urlSearch);
      }
    });
  }

  setStatus(status: StatusFilter): void {
    this.updateFilters({ status });
  }

  setKind(kind: KindFilter): void {
    this.updateFilters({ kind });
  }

  toggleFavoriteOnly(): void {
    this.updateFilters({ favoriteOnly: !this.filters().favoriteOnly });
  }

  onToggleFavorite(item: MediaItem): void {
    void this.repo.toggleFavorite(item.id);
  }

  protected favoriteAriaLabel(item: MediaItem): string {
    return this.i18n.t(item.favorite ? 'library.favorite.remove' : 'library.favorite.add', {
      title: item.title,
    });
  }

  onSortChange(event: Event): void {
    this.updateFilters({ sort: (event.target as HTMLSelectElement).value as LibrarySort });
  }

  onSearchInput(value: string): void {
    this.searchDraft.set(value);
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => this.updateFilters({ search: value }), SEARCH_DEBOUNCE_MS);
  }

  openAddDialog(): void {
    this.dialog.open(AddItemDialog);
  }

  protected ratingAriaLabel(item: MediaItem): string {
    return this.i18n.t('rating.ariaLabel', { value: item.myRating ?? 0 });
  }

  private updateFilters(patch: Partial<LibraryFilters>): void {
    const next = { ...this.filters(), ...patch };
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        status: next.status === 'all' ? null : next.status,
        kind: next.kind === 'all' ? null : next.kind,
        q: next.search || null,
        sort: next.sort === 'addedDesc' ? null : next.sort,
        fav: next.favoriteOnly ? '1' : null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
