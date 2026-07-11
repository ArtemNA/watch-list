import { Component, computed, input } from '@angular/core';

import { TPipe } from '../../../core/i18n/t.pipe';
import type { MediaKind } from '../../../core/models/media-item.model';
import { AppChip } from '../../../shared/ui/chip/app-chip';

export interface MediaHeaderInfo {
  kind: MediaKind;
  title: string;
  originalTitle?: string;
  year?: number;
  posterUrl?: string;
  overview?: string;
  genres?: string[];
  tmdbId?: number;
  imdbId?: string;
}

/**
 * Постер + назва/оригінальна назва/рік/тип/жанри/опис/лінки TMDB↗/IMDb↗ —
 * спільний блок item-page і preview-page (Step 13). `MediaItem` структурно
 * сумісний з `MediaHeaderInfo`, тож item-page передає айтем напряму.
 */
@Component({
  selector: 'app-media-header',
  imports: [TPipe, AppChip],
  templateUrl: './media-header.html',
  styleUrl: './media-header.scss',
})
export class MediaHeader {
  readonly media = input.required<MediaHeaderInfo>();

  protected readonly tmdbLink = computed<string | null>(() => {
    const m = this.media();
    return m.tmdbId !== undefined ? `https://www.themoviedb.org/${m.kind}/${m.tmdbId}` : null;
  });

  protected readonly imdbLink = computed<string | null>(() => {
    const imdbId = this.media().imdbId;
    return imdbId ? `https://www.imdb.com/title/${imdbId}` : null;
  });
}
