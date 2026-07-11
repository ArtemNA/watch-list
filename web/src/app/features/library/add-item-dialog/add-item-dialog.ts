import { Component, computed, inject, signal } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { ItemsRepository } from '../../../core/data/items.repository';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import type { MediaKind, MediaStatus } from '../../../core/models/media-item.model';
import { AppButton } from '../../../shared/ui/button/app-button';
import { AppInput } from '../../../shared/ui/input/app-input';

const KINDS: MediaKind[] = ['movie', 'tv'];
const STATUSES: MediaStatus[] = ['want', 'watching', 'watched', 'dropped'];

@Component({
  selector: 'app-add-item-dialog',
  imports: [MatDialogModule, TPipe, AppButton, AppInput],
  templateUrl: './add-item-dialog.html',
  styleUrl: './add-item-dialog.scss',
})
export class AddItemDialog {
  private readonly dialogRef = inject(MatDialogRef<AddItemDialog>);
  private readonly repo = inject(ItemsRepository);
  protected readonly i18n = inject(I18nService);

  protected readonly kinds = KINDS;
  protected readonly statuses = STATUSES;

  protected readonly title = signal('');
  protected readonly kind = signal<MediaKind>('movie');
  protected readonly year = signal('');
  protected readonly status = signal<MediaStatus>('want');
  protected readonly submitted = signal(false);

  protected readonly titleError = computed(() =>
    this.submitted() && !this.title().trim() ? this.i18n.t('addItem.errors.titleRequired') : null,
  );

  onKindChange(event: Event): void {
    this.kind.set((event.target as HTMLSelectElement).value as MediaKind);
  }

  onStatusChange(event: Event): void {
    this.status.set((event.target as HTMLSelectElement).value as MediaStatus);
  }

  close(): void {
    this.dialogRef.close();
  }

  async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.submitted.set(true);
    const title = this.title().trim();
    if (!title) {
      return;
    }

    const year = this.parseYear();
    await this.repo.add({
      title,
      kind: this.kind(),
      status: this.status(),
      ...(year !== undefined ? { year } : {}),
    });
    this.dialogRef.close(true);
  }

  private parseYear(): number | undefined {
    const raw = this.year().trim();
    if (!raw) {
      return undefined;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }
}
