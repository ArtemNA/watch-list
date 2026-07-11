import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { TPipe } from '../../../core/i18n/t.pipe';
import { AppButton } from '../../../shared/ui/button/app-button';

export interface DeleteConfirmDialogData {
  title: string;
}

@Component({
  selector: 'app-delete-confirm-dialog',
  imports: [MatDialogModule, TPipe, AppButton],
  templateUrl: './delete-confirm-dialog.html',
  styleUrl: './delete-confirm-dialog.scss',
})
export class DeleteConfirmDialog {
  protected readonly data = inject<DeleteConfirmDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<DeleteConfirmDialog>);

  cancel(): void {
    this.dialogRef.close(false);
  }

  confirm(): void {
    this.dialogRef.close(true);
  }
}
