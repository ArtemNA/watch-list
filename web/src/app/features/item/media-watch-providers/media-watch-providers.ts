import { Component, input } from '@angular/core';

import { TPipe } from '../../../core/i18n/t.pipe';
import type { WatchProviders } from '../../../core/models/media-item.model';
import { AppCard } from '../../../shared/ui/card/app-card';

/** Картка «Де подивитись» (Підписка/Оренда/Купівля + атрибуція JustWatch) — item-page і preview-page (Step 13). */
@Component({
  selector: 'app-media-watch-providers',
  imports: [TPipe, AppCard],
  templateUrl: './media-watch-providers.html',
  styleUrl: './media-watch-providers.scss',
})
export class MediaWatchProviders {
  readonly providers = input<WatchProviders | undefined>(undefined);
}
