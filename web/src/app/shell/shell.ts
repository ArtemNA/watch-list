import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs';

import { AuthService } from '../core/auth/auth.service';
import { TombstoneVacuumService } from '../core/data/tombstone-vacuum.service';
import { I18nService, Lang } from '../core/i18n/i18n.service';
import { TPipe } from '../core/i18n/t.pipe';
import { OnlineStatus } from '../core/network/online-status.service';
import { AppUpdateService } from '../core/pwa/app-update.service';
import { runInteractiveSync } from '../core/sync/run-interactive-sync';
import { SYNC_CLOCK_TICK_MS, syncStatusText } from '../core/sync/sync-status-text';
import { SyncService } from '../core/sync/sync.service';
import { ThemeService } from '../core/theme/theme.service';

// Повні самоназви — не через i18n-словник: назва мови на екрані завжди своя
// власна, незалежно від того, якою мовою зараз показаний інтерфейс.
const LANG_OPTIONS: { value: Lang; label: string }[] = [
  { value: 'uk', label: 'Українська' },
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
];

@Component({
  selector: 'app-shell',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    TPipe,
    MatMenuModule,
    MatTooltipModule,
  ],
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
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly langOptions = LANG_OPTIONS;

  // Ініціал акаунта для аватар-кола в хедері (Step 15) — email ніде в хедері
  // текстом не показується, лише перша літера в кружечку.
  protected readonly accountInitial = computed(() => this.auth.email()?.trim().charAt(0).toUpperCase() || '?');

  // Заголовок мобільного тонкого хедера (step-15 §2) — бере `data.titleKey`
  // найглибшого активного маршруту (app.routes.ts), інакше — назва апки.
  private readonly navigationEnd = toSignal(
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)),
    { initialValue: null },
  );

  protected readonly pageTitle = computed(() => {
    this.navigationEnd();
    let route = this.activatedRoute.snapshot;
    while (route.firstChild) {
      route = route.firstChild;
    }
    const titleKey = route.data['titleKey'] as string | undefined;
    return this.i18n.t(titleKey ?? 'app.title');
  });

  // Тримає тултіп індикатора синку ("N хв тому") відносно свіжим без reload —
  // без цього signal-based CD перечитав би текст лише при наступній НЕ
  // пов'язаній зі зчитуванням часу події.
  private readonly clockTick = signal(0);

  constructor() {
    inject(AppUpdateService); // тільки щоб проініціалізувати підписку на оновлення SW
    inject(TombstoneVacuumService); // тільки щоб запустити вакуум старих tombstones при старті
    const timer = setInterval(() => this.clockTick.update((n) => n + 1), SYNC_CLOCK_TICK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  setLang(lang: Lang): void {
    this.i18n.setLang(lang);
  }

  async runSync(): Promise<void> {
    await runInteractiveSync(this.sync, this.i18n, this.snackBar);
  }

  /** Текст тултіпу індикатора синку в хедері (ARCHITECTURE §6). */
  syncTooltip(): string {
    this.clockTick(); // тримає значення "N хв тому" свіжим (див. SYNC_CLOCK_TICK_MS)
    return syncStatusText(this.sync, this.i18n);
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/');
  }
}
