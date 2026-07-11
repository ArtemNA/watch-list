import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthError, AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import { AppButton } from '../../../shared/ui/button/app-button';
import { AppCard } from '../../../shared/ui/card/app-card';
import { AppInput } from '../../../shared/ui/input/app-input';

type AuthTab = 'login' | 'register';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

const ERROR_KEY_BY_CODE: Record<AuthError['code'], string> = {
  INVALID_EMAIL: 'auth.errors.invalidEmail',
  PASSWORD_TOO_SHORT: 'auth.errors.passwordTooShort',
  EMAIL_TAKEN: 'auth.errors.emailTaken',
  INVALID_CREDENTIALS: 'auth.errors.invalidCredentials',
  TOO_MANY_REQUESTS: 'auth.errors.tooManyRequests',
  UNKNOWN: 'auth.errors.unknown',
};

@Component({
  selector: 'app-auth-page',
  imports: [TPipe, AppButton, AppCard, AppInput],
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.scss',
})
export class AuthPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);

  protected readonly tab = signal<AuthTab>('login');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly passwordConfirm = signal('');
  protected readonly submitted = signal(false);
  protected readonly pending = signal(false);
  protected readonly serverErrorKey = signal<string | null>(null);

  protected readonly emailError = computed(() => {
    if (!this.submitted()) {
      return null;
    }
    return EMAIL_PATTERN.test(this.email().trim()) ? null : this.i18n.t('auth.errors.invalidEmail');
  });

  protected readonly passwordError = computed(() => {
    if (!this.submitted()) {
      return null;
    }
    return this.password().length >= MIN_PASSWORD_LENGTH ? null : this.i18n.t('auth.errors.passwordTooShort');
  });

  protected readonly passwordConfirmError = computed(() => {
    if (!this.submitted() || this.tab() !== 'register') {
      return null;
    }
    return this.password() === this.passwordConfirm() ? null : this.i18n.t('auth.errors.passwordMismatch');
  });

  setTab(tab: AuthTab): void {
    this.tab.set(tab);
    this.submitted.set(false);
    this.serverErrorKey.set(null);
  }

  async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.submitted.set(true);
    this.serverErrorKey.set(null);

    if (this.emailError() || this.passwordError() || this.passwordConfirmError()) {
      return;
    }

    this.pending.set(true);
    try {
      const email = this.email().trim();
      const password = this.password();
      if (this.tab() === 'register') {
        await this.auth.register(email, password);
      } else {
        await this.auth.login(email, password);
      }
      await this.router.navigateByUrl('/');
    } catch (error) {
      const code = error instanceof AuthError ? error.code : 'UNKNOWN';
      this.serverErrorKey.set(ERROR_KEY_BY_CODE[code]);
    } finally {
      this.pending.set(false);
    }
  }
}
