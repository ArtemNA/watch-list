import { Component, computed, inject, input, output, signal } from '@angular/core';

import { ItemsRepository } from '../../../core/data/items.repository';
import { ListsRepository } from '../../../core/data/lists.repository';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import type { MediaItem, MediaStatus } from '../../../core/models/media-item.model';
import type { ListEntry, MediaList } from '../../../core/models/media-list.model';
import type { SharePayload } from '../../../core/share/share-payload';
import { AppButton } from '../../../shared/ui/button/app-button';
import { AppChip } from '../../../shared/ui/chip/app-chip';
import { AppEmptyState } from '../../../shared/ui/empty-state/app-empty-state';

/**
 * Спільна "вітрина" шеру (ARCHITECTURE §9, крок 7-8) — той самий компонент
 * для /share/:code (payload з бекенда) і для імпорту за офлайн-кодом (payload
 * з base64). Не знає, звідки прийшов payload; сама лише читає бібліотеку
 * (резолв статусу по tmdbId) і за кліком створює НОВИЙ список — навігацію
 * після цього робить контейнер (сторінка чи діалог), не цей компонент.
 */
@Component({
  selector: 'app-shared-list-preview',
  imports: [TPipe, AppButton, AppChip, AppEmptyState],
  templateUrl: './shared-list-preview.html',
  styleUrl: './shared-list-preview.scss',
})
export class SharedListPreview {
  private readonly itemsRepo = inject(ItemsRepository);
  private readonly listsRepo = inject(ListsRepository);
  protected readonly i18n = inject(I18nService);

  readonly payload = input.required<SharePayload>();
  readonly listAdded = output<MediaList>();
  readonly discarded = output<void>();

  protected readonly adding = signal(false);

  private readonly byTmdbId = computed(() => {
    const map = new Map<number, MediaItem>();
    for (const item of this.itemsRepo.items()) {
      if (item.tmdbId !== undefined) {
        map.set(item.tmdbId, item);
      }
    }
    return map;
  });

  protected readonly matchCount = computed(
    () => this.payload().entries.filter((entry) => this.resolvedStatus(entry) !== null).length,
  );

  resolvedStatus(entry: ListEntry): MediaStatus | null {
    if (entry.tmdbId === undefined) {
      return null;
    }
    return this.byTmdbId().get(entry.tmdbId)?.status ?? null;
  }

  hasSharedExtras(entry: ListEntry): boolean {
    return !!entry.sharedNotes || !!(entry.sharedLinks && entry.sharedLinks.length > 0);
  }

  async addList(): Promise<void> {
    const payload = this.payload();
    this.adding.set(true);
    try {
      const name = this.i18n.t('share.preview.importedName', { name: payload.name, sharedBy: payload.sharedBy });
      const now = new Date().toISOString();
      const list = await this.listsRepo.createImported(name, [...payload.entries], {
        sharedBy: payload.sharedBy,
        sharedAt: now,
      });
      this.listAdded.emit(list);
    } finally {
      this.adding.set(false);
    }
  }

  discard(): void {
    this.discarded.emit();
  }
}
