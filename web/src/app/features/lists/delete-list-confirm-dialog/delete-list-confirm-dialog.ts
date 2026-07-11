import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { TPipe } from '../../../core/i18n/t.pipe';
import { AppButton } from '../../../shared/ui/button/app-button';

export interface DeleteListConfirmDialogData {
  name: string;
}

/** Аналог item/delete-confirm-dialog, але з текстом про список (не чіпає айтеми — ARCHITECTURE §9). */
@Component({
  selector: 'app-delete-list-confirm-dialog',
  imports: [MatDialogModule, TPipe, AppButton],
  templateUrl: './delete-list-confirm-dialog.html',
  styleUrl: './delete-list-confirm-dialog.scss',
})
export class DeleteListConfirmDialog {
  protected readonly data = inject<DeleteListConfirmDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<DeleteListConfirmDialog>);

  cancel(): void {
    this.dialogRef.close(false);
  }

  confirm(): void {
    this.dialogRef.close(true);
  }
}
