import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { I18nService, Lang } from '../core/i18n/i18n.service';
import { TPipe } from '../core/i18n/t.pipe';
import { ThemeService } from '../core/theme/theme.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, TPipe],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly theme = inject(ThemeService);
  protected readonly i18n = inject(I18nService);

  setLang(lang: Lang): void {
    this.i18n.setLang(lang);
  }
}
