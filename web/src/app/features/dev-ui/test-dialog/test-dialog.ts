import { Component, inject } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { TPipe } from '../../../core/i18n/t.pipe';
import { AppButton } from '../../../shared/ui/button/app-button';

@Component({
  selector: 'app-test-dialog',
  imports: [MatDialogModule, TPipe, AppButton],
  templateUrl: './test-dialog.html',
  styleUrl: './test-dialog.scss',
})
export class TestDialog {
  private readonly dialogRef = inject(MatDialogRef<TestDialog>);

  close(): void {
    this.dialogRef.close();
  }
}
