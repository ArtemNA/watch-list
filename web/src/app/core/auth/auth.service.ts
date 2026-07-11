import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

const TOKEN_KEY = 'watchlist.auth.token';
const EMAIL_KEY = 'watchlist.auth.email';
// НЕ чиститься в logout() — постійний маркер "юзер хоч раз логінився на цьому
// пристрої" (Step 09, задача 6: вакуум tombstones дозволений без синку лише
// якщо синкати нема з ким, тобто юзер НІКОЛИ не логінився).
const EVER_LOGGED_IN_KEY = 'watchlist.auth.everLoggedIn';

export type AuthErrorCode =
  | 'INVALID_EMAIL'
  | 'PASSWORD_TOO_SHORT'
  | 'EMAIL_TAKEN'
  | 'INVALID_CREDENTIALS'
  | 'TOO_MANY_REQUESTS'
  | 'UNKNOWN';

const KNOWN_ERROR_CODES: ReadonlySet<string> = new Set<AuthErrorCode>([
  'INVALID_EMAIL',
  'PASSWORD_TOO_SHORT',
  'EMAIL_TAKEN',
  'INVALID_CREDENTIALS',
  'TOO_MANY_REQUESTS',
]);

export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode) {
    super(code);
  }
}

interface AuthResponse {
  token: string;
  email: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  /** Сирий токен — потрібен інтерцептору, компоненти мають користуватись isLoggedIn/email. */
  readonly token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  readonly email = signal<string | null>(localStorage.getItem(EMAIL_KEY));
  readonly isLoggedIn = computed(() => this.token() !== null);

  async register(email: string, password: string): Promise<void> {
    await this.authenticate('/api/auth/register', email, password);
  }

  async login(email: string, password: string): Promise<void> {
    await this.authenticate('/api/auth/login', email, password);
  }

  /** Не чіпає локальні дані (IndexedDB) — тільки токен/email сесії. */
  logout(): void {
    this.token.set(null);
    this.email.set(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
  }

  /** Юзер хоч раз логінився на цьому пристрої (навіть якщо зараз розлогінений). */
  hasEverLoggedIn(): boolean {
    return localStorage.getItem(EVER_LOGGED_IN_KEY) === '1';
  }

  private async authenticate(url: string, email: string, password: string): Promise<void> {
    let response: AuthResponse;
    try {
      response = await firstValueFrom(this.http.post<AuthResponse>(url, { email, password }));
    } catch (error) {
      throw new AuthError(this.mapErrorCode(error));
    }

    this.token.set(response.token);
    this.email.set(response.email);
    localStorage.setItem(TOKEN_KEY, response.token);
    localStorage.setItem(EMAIL_KEY, response.email);
    localStorage.setItem(EVER_LOGGED_IN_KEY, '1');
  }

  private mapErrorCode(error: unknown): AuthErrorCode {
    if (error instanceof HttpErrorResponse) {
      const code = (error.error as { error?: string } | null)?.error;
      if (code && KNOWN_ERROR_CODES.has(code)) {
        return code as AuthErrorCode;
      }
    }
    return 'UNKNOWN';
  }
}
