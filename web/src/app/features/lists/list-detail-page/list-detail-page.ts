import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';

import { ItemsRepository } from '../../../core/data/items.repository';
import { ListsRepository } from '../../../core/data/lists.repository';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import type { MediaItem } from '../../../core/models/media-item.model';
import type { ListEntry, MediaList } from '../../../core/models/media-list.model';
import { AppButton } from '../../../shared/ui/button/app-button';
import { AppChip } from '../../../shared/ui/chip/app-chip';
import { AppEmptyState } from '../../../shared/ui/empty-state/app-empty-state';
import { DeleteListConfirmDialog } from '../delete-list-confirm-dialog/delete-list-confirm-dialog';
import { ListFormDialog, type ListFormDialogResult } from '../list-form-dialog/list-form-dialog';

@Component({
  selector: 'app-list-detail-page',
  imports: [RouterLink, TPipe, AppButton, AppChip, AppEmptyState, MatMenuModule],
  templateUrl: './list-detail-page.html',
  styleUrl: './list-detail-page.scss',
})
export class ListDetailPage {
  private readonly listsRepo = inject(ListsRepository);
  private readonly itemsRepo = inject(ItemsRepository);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly i18n = inject(I18nService);

  private readonly id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id') ?? '')), {
    initialValue: this.route.snapshot.paramMap.get('id') ?? '',
  });

  protected readonly list = computed<MediaList | null>(
    () => this.listsRepo.lists().find((candidate) => candidate.id === this.id()) ?? null,
  );

  private readonly libraryByTmdbId = computed(() => {
    const map = new Map<number, MediaItem>();
    for (const item of this.itemsRepo.items()) {
      if (item.tmdbId !== undefined) {
        map.set(item.tmdbId, item);
      }
    }
    return map;
  });

  private readonly libraryById = computed(() => new Map(this.itemsRepo.items().map((item) => [item.id, item])));

  /** Резолв entry в бібліотеку: по tmdbId, або fallback по id (ручні айтеми — ARCHITECTURE §9/крок 6). */
  resolvedItem(entry: ListEntry): MediaItem | null {
    if (entry.tmdbId !== undefined) {
      return this.libraryByTmdbId().get(entry.tmdbId) ?? null;
    }
    return this.libraryById().get(entry.id) ?? null;
  }

  posterFor(entry: ListEntry): string | null {
    return this.resolvedItem(entry)?.posterUrl ?? entry.snapshot.posterUrl ?? null;
  }

  titleFor(entry: ListEntry): string {
    return this.resolvedItem(entry)?.title ?? entry.snapshot.title;
  }

  yearFor(entry: ListEntry): number | undefined {
    return this.resolvedItem(entry)?.year ?? entry.snapshot.year;
  }

  async addToLibrary(entry: ListEntry): Promise<void> {
    const list = this.list();
    if (!list) {
      return;
    }
    const newItem = await this.itemsRepo.add({
      kind: entry.kind,
      status: 'want',
      title: entry.snapshot.title,
      originalTitle: entry.snapshot.originalTitle,
      year: entry.snapshot.year,
      posterUrl: entry.snapshot.posterUrl,
      tmdbId: entry.tmdbId,
      imdbId: entry.imdbId,
    });
    if (entry.tmdbId === undefined) {
      // Без tmdbId резолв іде по id — новий айтем отримав власний uuid,
      // тому entry.id мусить піти за ним (див. lists.repository.relinkEntry).
      await this.listsRepo.relinkEntry(list.id, entry.id, newItem.id);
    }
  }

  removeEntry(entry: ListEntry): void {
    const list = this.list();
    if (!list) {
      return;
    }
    void this.listsRepo.removeEntry(list.id, entry.id);
  }

  async openRenameDialog(): Promise<void> {
    const list = this.list();
    if (!list) {
      return;
    }
    const ref = this.dialog.open<ListFormDialog, unknown, ListFormDialogResult>(ListFormDialog, {
      data: { name: list.name, description: list.description ?? '' },
    });
    const result = await firstValueFrom(ref.afterClosed());
    if (!result) {
      return;
    }
    if (result.name !== list.name) {
      await this.listsRepo.rename(list.id, result.name);
    }
    if (result.description !== (list.description ?? '')) {
      await this.listsRepo.updateDescription(list.id, result.description);
    }
  }

  openDeleteConfirm(): void {
    const list = this.list();
    if (!list) {
      return;
    }
    const ref = this.dialog.open(DeleteListConfirmDialog, { data: { name: list.name } });
    ref.afterClosed().subscribe((confirmed: boolean | undefined) => {
      if (confirmed) {
        void this.deleteList(list);
      }
    });
  }

  private async deleteList(list: MediaList): Promise<void> {
    await this.listsRepo.softDelete(list.id);
    await this.router.navigate(['/lists']);

    const ref = this.snackBar.open(
      this.i18n.t('lists.delete.snackbarMessage', { name: list.name }),
      this.i18n.t('item.delete.undo'),
      { duration: 6000 },
    );
    ref.onAction().subscribe(() => {
      void this.listsRepo.restore(list.id);
    });
  }
}
