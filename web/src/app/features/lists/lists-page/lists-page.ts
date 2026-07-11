import { Component, computed, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ItemsRepository } from '../../../core/data/items.repository';
import { ListsRepository } from '../../../core/data/lists.repository';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import type { MediaList } from '../../../core/models/media-list.model';
import { AppButton } from '../../../shared/ui/button/app-button';
import { AppEmptyState } from '../../../shared/ui/empty-state/app-empty-state';
import { DeleteListConfirmDialog } from '../delete-list-confirm-dialog/delete-list-confirm-dialog';
import type { DerivedList, DerivedListKey } from '../derived-lists';
import { buildDerivedLists } from '../derived-lists';
import { ImportByCodeDialog } from '../import-by-code-dialog/import-by-code-dialog';
import { ListFormDialog, type ListFormDialogResult } from '../list-form-dialog/list-form-dialog';
import { shareSourceFromDerived, shareSourceFromList } from '../share-source';
import { ShareListDialog } from '../share-list-dialog/share-list-dialog';

@Component({
  selector: 'app-lists-page',
  imports: [RouterLink, TPipe, AppButton, AppEmptyState, MatMenuModule],
  templateUrl: './lists-page.html',
  styleUrl: './lists-page.scss',
})
export class ListsPage {
  private readonly itemsRepo = inject(ItemsRepository);
  private readonly listsRepo = inject(ListsRepository);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);

  protected readonly derivedLists = computed<DerivedList[]>(() => buildDerivedLists(this.itemsRepo.items()));

  protected readonly customLists = computed<MediaList[]>(() =>
    [...this.listsRepo.lists()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  );

  /** Похідні списки НЕ редагуються (склад = статуси/прапорці) — клік веде у відфільтровану бібліотеку. */
  derivedListQueryParams(key: DerivedListKey): Record<string, string> {
    return key === 'favorite' ? { fav: '1' } : { status: key };
  }

  derivedListCover(list: DerivedList): string[] {
    return list.items
      .map((item) => item.posterUrl)
      .filter((url): url is string => !!url)
      .slice(0, 4);
  }

  customListCover(list: MediaList): string[] {
    return list.entries
      .map((entry) => entry.snapshot.posterUrl)
      .filter((url): url is string => !!url)
      .slice(0, 4);
  }

  async openCreateDialog(): Promise<void> {
    const ref = this.dialog.open<ListFormDialog, unknown, ListFormDialogResult>(ListFormDialog);
    const result = await firstValueFrom(ref.afterClosed());
    if (!result) {
      return;
    }
    const list = await this.listsRepo.create(result.name, result.description || undefined);
    await this.router.navigate(['/lists', list.id]);
  }

  async openRenameDialog(list: MediaList): Promise<void> {
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

  openShareDialogForList(list: MediaList): void {
    this.dialog.open(ShareListDialog, { data: { source: shareSourceFromList(list) } });
  }

  openShareDialogForDerived(list: DerivedList): void {
    this.dialog.open(ShareListDialog, { data: { source: shareSourceFromDerived(list, this.i18n) } });
  }

  openImportByCodeDialog(): void {
    this.dialog.open(ImportByCodeDialog);
  }

  openDeleteConfirm(list: MediaList): void {
    const ref = this.dialog.open(DeleteListConfirmDialog, { data: { name: list.name } });
    ref.afterClosed().subscribe((confirmed: boolean | undefined) => {
      if (confirmed) {
        void this.deleteList(list);
      }
    });
  }

  private async deleteList(list: MediaList): Promise<void> {
    await this.listsRepo.softDelete(list.id);
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
