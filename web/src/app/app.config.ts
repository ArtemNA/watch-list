import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { MAT_DIALOG_DEFAULT_OPTIONS } from '@angular/material/dialog';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';

import { authInterceptor } from './core/auth/auth.interceptor';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideHttpClient(withInterceptors([authInterceptor])),
    // Один спільний контракт ширини для ВСІХ MatDialog (борг зі step-04, ARCHITECTURE §8:
    // "діалог на всю ширину на мобільному" — тепер одне правило, а не копіпаста в кожному dialog.open).
    {
      provide: MAT_DIALOG_DEFAULT_OPTIONS,
      useValue: {
        width: 'min(480px, calc(100vw - 32px))',
        autoFocus: 'first-tabbable',
        restoreFocus: true,
      },
    },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
