import { Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import { AppButton } from '../../../shared/ui/button/app-button';
import { AppInput } from '../../../shared/ui/input/app-input';

export interface ListFormDialogData {
  /** Присутнє в режимі редагування (rename) — заповнює поля початковими значеннями. */
  name?: string;
  description?: string;
}

export interface ListFormDialogResult {
  name: string;
  description: string;
}

/** Одна форма і для «Новий список», і для rename/опису — Step 11, задача 6. */
@Component({
  selector: 'app-list-form-dialog',
  imports: [MatDialogModule, TPipe, AppButton, AppInput],
  templateUrl: './list-form-dialog.html',
  styleUrl: './list-form-dialog.scss',
})
export class ListFormDialog {
  private readonly data = inject<ListFormDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialogRef = inject(MatDialogRef<ListFormDialog, ListFormDialogResult>);
  protected readonly i18n = inject(I18nService);

  protected readonly isEdit = !!this.data;
  protected readonly name = signal(this.data?.name ?? '');
  protected readonly description = signal(this.data?.description ?? '');
  protected readonly submitted = signal(false);

  protected readonly nameError = computed(() =>
    this.submitted() && !this.name().trim() ? this.i18n.t('lists.form.errors.nameRequired') : null,
  );

  close(): void {
    this.dialogRef.close();
  }

  submit(event: Event): void {
    event.preventDefault();
    this.submitted.set(true);
    const name = this.name().trim();
    if (!name) {
      return;
    }
    this.dialogRef.close({ name, description: this.description().trim() });
  }
}
