import { Component, inject } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../core/auth/auth.service';
import { I18nService, Lang } from '../core/i18n/i18n.service';
import { TPipe } from '../core/i18n/t.pipe';
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
  private readonly router = inject(Router);

  setLang(lang: Lang): void {
    this.i18n.setLang(lang);
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/');
  }
}
