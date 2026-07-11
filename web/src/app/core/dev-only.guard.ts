import { inject, isDevMode } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/**
 * Ховає /dev/ui у продакшн-білді (Step 09, задача 5) — САМУ сторінку не
 * видаляємо, вона лишається постійним каталогом дизайн-системи (CLAUDE.md).
 * `isDevMode()` повертає false у production-конфігурації Angular CLI білду.
 */
export const devOnlyGuard: CanActivateFn = () => isDevMode() || inject(Router).parseUrl('/');
