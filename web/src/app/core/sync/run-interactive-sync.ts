import type { MatSnackBar } from '@angular/material/snack-bar';

import type { I18nService } from '../i18n/i18n.service';
import type { SyncService } from './sync.service';

/**
 * Ручний синк по кліку (індикатор у хедері, кнопка на Профілі — step-15 §4) —
 * той самий снекбар-фідбек в обох місцях (ARCHITECTURE §6).
 */
export async function runInteractiveSync(
  sync: SyncService,
  i18n: I18nService,
  snackBar: MatSnackBar,
): Promise<void> {
  try {
    const summary = await sync.sync({ interactive: true });
    if (!summary) {
      return;
    }
    const message = i18n.t('sync.summary', {
      pulled: summary.pulled,
      pushed: summary.pushed,
      conflicts: summary.conflicts,
    });
    snackBar.open(message, undefined, { duration: 4000 });
  } catch {
    snackBar.open(i18n.t('sync.error'), undefined, { duration: 4000 });
  }
}
