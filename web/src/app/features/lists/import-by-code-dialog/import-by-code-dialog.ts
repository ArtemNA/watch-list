import { Component, inject, signal } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import type { MediaList } from '../../../core/models/media-list.model';
import { decodeSharePayload, parsePayload, type SharePayload } from '../../../core/share/share-payload';
import { AppButton } from '../../../shared/ui/button/app-button';
import { AppInput } from '../../../shared/ui/input/app-input';
import { SharedListPreview } from '../../share/shared-list-preview/shared-list-preview';

type Phase = 'input' | 'preview';

/**
 * Імпорт офлайн base64-коду (ARCHITECTURE §9, крок 8) — та сама SharedListPreview,
 * що на /share/:code, лише дані з вставленого коду замість бекенда. Працює
 * повністю офлайн: decodeSharePayload/parsePayload — чисті функції, без мережі.
 */
@Component({
  selector: 'app-import-by-code-dialog',
  imports: [MatDialogModule, TPipe, AppButton, AppInput, SharedListPreview],
  templateUrl: './import-by-code-dialog.html',
  styleUrl: './import-by-code-dialog.scss',
})
export class ImportByCodeDialog {
  protected readonly dialogRef = inject(MatDialogRef<ImportByCodeDialog>);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly i18n = inject(I18nService);

  protected readonly code = signal('');
  protected readonly phase = signal<Phase>('input');
  protected readonly invalid = signal(false);
  protected readonly payload = signal<SharePayload | null>(null);

  submit(): void {
    this.invalid.set(false);
    const parsed = parsePayload(decodeSharePayload(this.code().trim()));
    if (parsed instanceof Error) {
      this.invalid.set(true);
      return;
    }
    this.payload.set(parsed);
    this.phase.set('preview');
  }

  onListAdded(list: MediaList): void {
    this.dialogRef.close();
    void this.router.navigate(['/lists', list.id]);
    this.snackBar.open(this.i18n.t('share.preview.addSuccess', { name: list.name }), this.i18n.t('common.cancel'), {
      duration: 5000,
    });
  }

  onDiscarded(): void {
    this.dialogRef.close();
  }
}
