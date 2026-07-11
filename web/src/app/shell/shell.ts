import { Component, DestroyRef, inject, signal } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../core/auth/auth.service';
import { TombstoneVacuumService } from '../core/data/tombstone-vacuum.service';
import { I18nService, Lang } from '../core/i18n/i18n.service';
import { TPipe } from '../core/i18n/t.pipe';
import { OnlineStatus } from '../core/network/online-status.service';
import { AppUpdateService } from '../core/pwa/app-update.service';
import { SyncService } from '../core/sync/sync.service';
import { ThemeService } from '../core/theme/theme.service';

// Тримає тултіп індикатора синку ("N хв тому") відносно свіжим без reload —
// без цього signal-based CD перечитав би текст лише при наступній НЕ
// пов'язаній зі зчитуванням часу події.
const CLOCK_TICK_MS = 60_000;

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, TPipe, MatMenuModule, MatTooltipModule],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly theme = inject(ThemeService);
  protected readonly i18n = inject(I18nService);
  protected readonly auth = inject(AuthService);
  protected readonly sync = inject(SyncService);
  protected readonly online = inject(OnlineStatus);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  private readonly clockTick = signal(0);

  constructor() {
    inject(AppUpdateService); // тільки щоб проініціалізувати підписку на оновлення SW
    inject(TombstoneVacuumService); // тільки щоб запустити вакуум старих tombstones при старті
    const timer = setInterval(() => this.clockTick.update((n) => n + 1), CLOCK_TICK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  setLang(lang: Lang): void {
    this.i18n.setLang(lang);
  }

  async runSync(): Promise<void> {
    try {
      const summary = await this.sync.sync({ interactive: true });
      if (!summary) {
        return;
      }
      const message = this.i18n.t('sync.summary', {
        pulled: summary.pulled,
        pushed: summary.pushed,
        conflicts: summary.conflicts,
      });
      this.snackBar.open(message, undefined, { duration: 4000 });
    } catch {
      this.snackBar.open(this.i18n.t('sync.error'), undefined, { duration: 4000 });
    }
  }

  /** Текст тултіпу індикатора синку в хедері (ARCHITECTURE §6). */
  syncTooltip(): string {
    this.clockTick(); // тримає значення "N хв тому" свіжим (див. CLOCK_TICK_MS)
    if (this.sync.isSyncing()) {
      return this.i18n.t('sync.indicator.syncing');
    }
    if (this.sync.state() === 'error') {
      return this.i18n.t('sync.indicator.error');
    }
    if (this.sync.pendingConflicts() > 0) {
      return this.i18n.t('sync.indicator.conflicts', { count: this.sync.pendingConflicts() });
    }
    const lastSyncAt = this.sync.lastSyncAt();
    if (!lastSyncAt) {
      return this.i18n.t('sync.indicator.neverSynced');
    }
    return this.i18n.t('sync.indicator.synced', { time: this.relativeTime(lastSyncAt) });
  }

  private relativeTime(iso: string): string {
    const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
    if (minutes < 1) {
      return this.i18n.t('sync.indicator.justNow');
    }
    return this.i18n.t('sync.indicator.minutesAgo', { minutes });
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/');
  }
}
