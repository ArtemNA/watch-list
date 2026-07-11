import { Component, computed, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { AppButton } from '../../shared/ui/button/app-button';
import { AppCard } from '../../shared/ui/card/app-card';
import { AppChip } from '../../shared/ui/chip/app-chip';
import { AppEmptyState } from '../../shared/ui/empty-state/app-empty-state';
import { AppInput } from '../../shared/ui/input/app-input';
import { AppRating } from '../../shared/ui/rating/app-rating';
import { TestDialog } from './test-dialog/test-dialog';

@Component({
  selector: 'app-dev-ui',
  imports: [TPipe, AppButton, AppCard, AppChip, AppEmptyState, AppInput, AppRating],
  templateUrl: './dev-ui.html',
  styleUrl: './dev-ui.scss',
})
export class DevUi {
  private readonly dialog = inject(MatDialog);
  private readonly i18n = inject(I18nService);

  protected readonly rating = signal(6);
  protected readonly noteValue = signal('');

  protected readonly editableRatingLabel = computed(() =>
    this.i18n.t('rating.ariaLabel', { value: this.rating() }),
  );
  protected readonly readonlyRatingLabel = computed(() =>
    this.i18n.t('rating.ariaLabel', { value: 8 }),
  );

  openTestDialog(): void {
    this.dialog.open(TestDialog);
  }
}
