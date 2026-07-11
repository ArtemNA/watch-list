import { Component, inject } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../core/auth/auth.service';
import { I18nService, Lang } from '../core/i18n/i18n.service';
import { TPipe } from '../core/i18n/t.pipe';
import { SyncService } from '../core/sync/sync.service';
import { ThemeService } from '../core/theme/theme.service';

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
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  setLang(lang: Lang): void {
    this.i18n.setLang(lang);
  }

  async runSync(): Promise<void> {
    try {
      const summary = await this.sync.sync();
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

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/');
  }
}
