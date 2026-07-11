import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';

import { I18nService } from '../i18n/i18n.service';
import { AuthService } from './auth.service';

const SYNC_PREFIX = '/api/sync/';

/** Додає Authorization: Bearer до запитів на /api/sync/* (Step 08); 401 звідти -> logout + снекбар. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const snackBar = inject(MatSnackBar);
  const i18n = inject(I18nService);

  const isSyncRequest = req.url.startsWith(SYNC_PREFIX);
  const token = authService.token();
  const authorizedReq =
    isSyncRequest && token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authorizedReq).pipe(
    catchError((error: unknown) => {
      if (isSyncRequest && error instanceof HttpErrorResponse && error.status === 401) {
        authService.logout();
        snackBar.open(i18n.t('auth.sessionExpired'), i18n.t('common.cancel'), { duration: 5000 });
      }
      return throwError(() => error);
    }),
  );
};
