import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthError, AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('starts logged out when localStorage has no token', () => {
    expect(service.isLoggedIn()).toBe(false);
    expect(service.email()).toBeNull();
  });

  it('login stores the token/email in signals and localStorage', async () => {
    const promise = service.login('user@example.com', 'password123');
    httpMock.expectOne('/api/auth/login').flush({ token: 'jwt-token', email: 'user@example.com' });
    await promise;

    expect(service.isLoggedIn()).toBe(true);
    expect(service.token()).toBe('jwt-token');
    expect(service.email()).toBe('user@example.com');
    expect(localStorage.getItem('watchlist.auth.token')).toBe('jwt-token');
    expect(localStorage.getItem('watchlist.auth.email')).toBe('user@example.com');
  });

  it('register behaves the same as login on success', async () => {
    const promise = service.register('new@example.com', 'password123');
    httpMock.expectOne('/api/auth/register').flush({ token: 'jwt-token-2', email: 'new@example.com' });
    await promise;

    expect(service.isLoggedIn()).toBe(true);
    expect(service.email()).toBe('new@example.com');
  });

  it('logout clears signals and localStorage without touching other keys', async () => {
    const promise = service.login('user@example.com', 'password123');
    httpMock.expectOne('/api/auth/login').flush({ token: 'jwt-token', email: 'user@example.com' });
    await promise;

    localStorage.setItem('watchlist.lang', 'uk');
    service.logout();

    expect(service.isLoggedIn()).toBe(false);
    expect(service.token()).toBeNull();
    expect(service.email()).toBeNull();
    expect(localStorage.getItem('watchlist.auth.token')).toBeNull();
    expect(localStorage.getItem('watchlist.auth.email')).toBeNull();
    expect(localStorage.getItem('watchlist.lang')).toBe('uk');
  });

  it('maps a 409 EMAIL_TAKEN response to an AuthError and leaves the session logged out', async () => {
    const promise = service.register('taken@example.com', 'password123');
    httpMock.expectOne('/api/auth/register').flush({ error: 'EMAIL_TAKEN' }, { status: 409, statusText: 'Conflict' });

    await expect(promise).rejects.toBeInstanceOf(AuthError);
    await expect(promise).rejects.toMatchObject({ code: 'EMAIL_TAKEN' });
    expect(service.isLoggedIn()).toBe(false);
  });

  it('maps a 401 INVALID_CREDENTIALS response to an AuthError', async () => {
    const promise = service.login('user@example.com', 'wrong-password');
    httpMock
      .expectOne('/api/auth/login')
      .flush({ error: 'INVALID_CREDENTIALS' }, { status: 401, statusText: 'Unauthorized' });

    await expect(promise).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('maps an unrecognized error response to AuthError with code UNKNOWN', async () => {
    const promise = service.login('user@example.com', 'password123');
    httpMock.expectOne('/api/auth/login').flush('boom', { status: 500, statusText: 'Server Error' });

    await expect(promise).rejects.toMatchObject({ code: 'UNKNOWN' });
  });
});
