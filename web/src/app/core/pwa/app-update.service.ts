import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';

import { I18nService } from '../i18n/i18n.service';

/**
 * Банер оновлення версії (Step 09, задача 2): коли service worker завантажив
 * нову версію апки, показуємо снекбар «Оновити» замість мовчазного застосування
 * (щоб не зірвати те, що юзер саме робить). Ін'єктується один раз у Shell —
 * тільки щоб проініціалізувати підписку (сама по собі нічого не рендерить).
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  // optional: true — у тестах (і будь-де без provideServiceWorker) провайдера
  // SwUpdate не існує взагалі; звичайний inject() впав би з NG0201.
  private readonly swUpdate = inject(SwUpdate, { optional: true });
  private readonly snackBar = inject(MatSnackBar);
  private readonly i18n = inject(I18nService);

  constructor() {
    if (!this.swUpdate?.isEnabled) {
      return;
    }
    this.swUpdate.versionUpdates
      .pipe(filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'))
      .subscribe(() => this.notify());
  }

  private notify(): void {
    const ref = this.snackBar.open(this.i18n.t('pwa.updateAvailable'), this.i18n.t('pwa.updateAction'), {
      duration: 0,
    });
    ref.onAction().subscribe(() => {
      void this.swUpdate?.activateUpdate().then(() => document.location.reload());
    });
  }
}
