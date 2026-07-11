import { Component, computed, input } from '@angular/core';

import { TPipe } from '../../../core/i18n/t.pipe';
import type { ExternalRatings } from '../../../core/models/media-item.model';
import { AppCard } from '../../../shared/ui/card/app-card';

interface RatingEntry {
  key: 'tmdb' | 'imdb' | 'rottenTomatoes' | 'metacritic';
  value: string;
}

/** Картка TMDB/IMDb/RT/Metacritic — спільна для item-page і preview-page (Step 13). Себе ховає, якщо рейтингів немає. */
@Component({
  selector: 'app-media-ratings',
  imports: [TPipe, AppCard],
  templateUrl: './media-ratings.html',
  styleUrl: './media-ratings.scss',
})
export class MediaRatings {
  readonly ratings = input<ExternalRatings | undefined>(undefined);

  protected readonly entries = computed<RatingEntry[]>(() => {
    const ratings = this.ratings();
    if (!ratings) {
      return [];
    }
    // Перевіряємо тип, а не `!== undefined`: після синку/санітизації поля можуть
    // приходити як null (JSON не має undefined), а `null.toFixed()` кидав би помилку.
    const entries: RatingEntry[] = [];
    if (typeof ratings.tmdb === 'number') {
      entries.push({ key: 'tmdb', value: ratings.tmdb.toFixed(1) });
    }
    if (typeof ratings.imdb === 'number') {
      entries.push({ key: 'imdb', value: ratings.imdb.toFixed(1) });
    }
    if (ratings.rottenTomatoes) {
      entries.push({ key: 'rottenTomatoes', value: ratings.rottenTomatoes });
    }
    if (typeof ratings.metacritic === 'number') {
      entries.push({ key: 'metacritic', value: String(ratings.metacritic) });
    }
    return entries;
  });
}
