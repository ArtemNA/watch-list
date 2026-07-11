import { Component, inject, signal } from '@angular/core';

import { ItemsRepository } from '../../core/data/items.repository';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import type { MediaItem, MediaKind, MediaStatus } from '../../core/models/media-item.model';
import { AppButton } from '../../shared/ui/button/app-button';
import { AppCard } from '../../shared/ui/card/app-card';
import { AppChip } from '../../shared/ui/chip/app-chip';
import { AppInput } from '../../shared/ui/input/app-input';

const KINDS: MediaKind[] = ['movie', 'tv'];
const STATUSES: MediaStatus[] = ['want', 'watching', 'watched', 'dropped'];
const EPOCH = '1970-01-01T00:00:00.000Z';

@Component({
  selector: 'app-dev-data',
  imports: [TPipe, AppButton, AppCard, AppChip, AppInput],
  templateUrl: './dev-data.html',
  styleUrl: './dev-data.scss',
})
export class DevData {
  private readonly repo = inject(ItemsRepository);
  protected readonly i18n = inject(I18nService);

  protected readonly kinds = KINDS;
  protected readonly statuses = STATUSES;

  protected readonly titleValue = signal('');
  protected readonly kindValue = signal<MediaKind>('movie');
  protected readonly statusValue = signal<MediaStatus>('want');

  protected readonly items = this.repo.items;
  protected readonly counts = this.repo.counts;
  protected readonly trashed = signal<MediaItem[]>([]);

  constructor() {
    void this.refreshTrash();
  }

  async onAdd(event: Event): Promise<void> {
    event.preventDefault();
    const title = this.titleValue().trim();
    if (!title) {
      return;
    }
    await this.repo.add({ title, kind: this.kindValue(), status: this.statusValue() });
    this.titleValue.set('');
  }

  onKindChange(event: Event): void {
    this.kindValue.set((event.target as HTMLSelectElement).value as MediaKind);
  }

  onStatusChange(event: Event): void {
    this.statusValue.set((event.target as HTMLSelectElement).value as MediaStatus);
  }

  async setStatus(item: MediaItem, status: MediaStatus): Promise<void> {
    await this.repo.update(item.id, { status });
  }

  async remove(item: MediaItem): Promise<void> {
    await this.repo.softDelete(item.id);
    await this.refreshTrash();
  }

  async restore(item: MediaItem): Promise<void> {
    await this.repo.restore(item.id);
    await this.refreshTrash();
  }

  private async refreshTrash(): Promise<void> {
    const changed = await this.repo.changedSince(EPOCH);
    this.trashed.set(changed.filter((item) => !!item.deletedAt));
  }
}
