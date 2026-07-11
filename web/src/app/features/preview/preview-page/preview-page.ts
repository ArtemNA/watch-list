import { Location } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import { ItemsRepository } from '../../../core/data/items.repository';
import { I18nService, type Lang } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import type { MediaKind, MediaStatus } from '../../../core/models/media-item.model';
import { OnlineStatus } from '../../../core/network/online-status.service';
import { AppButton } from '../../../shared/ui/button/app-button';
import { AppCard } from '../../../shared/ui/card/app-card';
import { AppEmptyState } from '../../../shared/ui/empty-state/app-empty-state';
import { AppSplitButton, type SplitButtonOption } from '../../../shared/ui/split-button/app-split-button';
import { MediaHeader } from '../../item/media-header/media-header';
import { MediaRatings } from '../../item/media-ratings/media-ratings';
import { MediaWatchProviders } from '../../item/media-watch-providers/media-watch-providers';
import type { SearchResult } from '../../search/search-mapping';
import { SearchService } from '../../search/search.service';
import { findExistingItemId } from '../preview-redirect';
import { PreviewService, type PreviewData } from '../preview.service';

type PreviewStatus = 'loading' | 'error' | 'ready';
const ADD_AS_STATUSES: MediaStatus[] = ['watching', 'watched', 'dropped'];

@Component({
  selector: 'app-preview-page',
  imports: [TPipe, AppButton, AppCard, AppEmptyState, AppSplitButton, MediaHeader, MediaRatings, MediaWatchProviders],
  templateUrl: './preview-page.html',
  styleUrl: './preview-page.scss',
})
export class PreviewPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly repo = inject(ItemsRepository);
  private readonly previewService = inject(PreviewService);
  private readonly searchService = inject(SearchService);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly i18n = inject(I18nService);
  protected readonly online = inject(OnlineStatus);

  private readonly kindParam = toSignal(this.route.paramMap.pipe(map((params) => params.get('kind') ?? '')), {
    initialValue: this.route.snapshot.paramMap.get('kind') ?? '',
  });
  private readonly tmdbIdParam = toSignal(this.route.paramMap.pipe(map((params) => params.get('tmdbId') ?? '')), {
    initialValue: this.route.snapshot.paramMap.get('tmdbId') ?? '',
  });

  protected readonly kind = computed<MediaKind | null>(() => {
    const value = this.kindParam();
    return value === 'movie' || value === 'tv' ? value : null;
  });

  protected readonly tmdbId = computed<number | null>(() => {
    const value = Number(this.tmdbIdParam());
    return Number.isInteger(value) && value > 0 ? value : null;
  });

  /** Вже в бібліотеці за (kind, tmdbId) — тоді превью не показуємо (Step 13). */
  protected readonly existingItemId = computed<string | undefined>(() => {
    const kind = this.kind();
    const tmdbId = this.tmdbId();
    if (kind === null || tmdbId === null) {
      return undefined;
    }
    return findExistingItemId(this.repo.items(), kind, tmdbId);
  });

  protected readonly status = signal<PreviewStatus>('loading');
  protected readonly data = signal<PreviewData | null>(null);
  protected readonly adding = signal(false);

  protected readonly addAsOptions = computed<SplitButtonOption[]>(() =>
    ADD_AS_STATUSES.map((status) => ({ value: status, label: this.i18n.t(`status.${status}`) })),
  );

  private loadedForKey: string | null = null;

  constructor() {
    // Редірект миттєвий (в конструкторі, до першого рендеру контенту) — щоб
    // превью айтема, який уже є в бібліотеці, не блимнуло перед item-page.
    effect(() => {
      const existingId = this.existingItemId();
      if (existingId) {
        void this.router.navigate(['/item', existingId], { replaceUrl: true });
      }
    });

    // Довантаження при відкритті і при зміні мови UI на відкритій сторінці
    // (той самий guard-по-ключу підхід, що на item-page — Step 06, задача 3).
    effect(() => {
      const kind = this.kind();
      const tmdbId = this.tmdbId();
      const lang = this.i18n.lang();
      if (kind === null || tmdbId === null || this.existingItemId() !== undefined || !this.online.isOnline()) {
        return;
      }
      const key = `${kind}:${tmdbId}:${lang}`;
      if (key === this.loadedForKey) {
        return;
      }
      this.loadedForKey = key;
      void this.load(kind, tmdbId, lang);
    });
  }

  retry(): void {
    this.loadedForKey = null;
    const kind = this.kind();
    const tmdbId = this.tmdbId();
    if (kind !== null && tmdbId !== null) {
      void this.load(kind, tmdbId, this.i18n.lang());
    }
  }

  goBack(): void {
    this.location.back();
  }

  addToLibrary(): void {
    void this.doAdd('want');
  }

  /** MatMenu-опції завжди зі скінченного набору ADD_AS_STATUSES — каст безпечний. */
  addToLibraryAs(status: string): void {
    void this.doAdd(status as MediaStatus);
  }

  private async load(kind: MediaKind, tmdbId: number, lang: Lang): Promise<void> {
    this.status.set('loading');
    try {
      const data = await this.previewService.load(kind, tmdbId, lang);
      this.data.set(data);
      this.status.set('ready');
    } catch {
      this.status.set('error');
    }
  }

  private async doAdd(status: MediaStatus): Promise<void> {
    const previewData = this.data();
    const kind = this.kind();
    const tmdbId = this.tmdbId();
    if (!previewData || kind === null || tmdbId === null) {
      return;
    }

    this.adding.set(true);
    try {
      const result: SearchResult = {
        id: tmdbId,
        kind,
        title: previewData.title,
        originalTitle: previewData.originalTitle,
        year: previewData.year,
        posterUrl: previewData.posterUrl,
        voteAverage: previewData.externalRatings?.tmdb,
        inLibrary: false,
      };
      const { mediaItem } = await this.searchService.addToLibrary(result, status);
      await this.router.navigate(['/item', mediaItem.id]);
      this.snackBar.open(
        this.i18n.t('search.add.success', { title: mediaItem.title }),
        this.i18n.t('common.cancel'),
        { duration: 5000 },
      );
    } catch {
      this.snackBar.open(this.i18n.t('search.add.error'), this.i18n.t('common.cancel'), { duration: 5000 });
    } finally {
      this.adding.set(false);
    }
  }
}
