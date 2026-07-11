import { TestBed } from '@angular/core/testing';

import { ThemeService } from './theme.service';

const STORAGE_KEY = 'watchlist.theme';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to dark when nothing is stored and system prefers dark', () => {
    const service = TestBed.inject(ThemeService);

    expect(service.theme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('restores the previously stored theme', () => {
    localStorage.setItem(STORAGE_KEY, 'light');

    const service = TestBed.inject(ThemeService);

    expect(service.theme()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('sets data-theme on <html> and persists the choice', () => {
    const service = TestBed.inject(ThemeService);

    service.setTheme('light');

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
  });

  it('toggle() flips between dark and light', () => {
    const service = TestBed.inject(ThemeService);
    service.setTheme('dark');

    service.toggle();
    expect(service.theme()).toBe('light');

    service.toggle();
    expect(service.theme()).toBe('dark');
  });
});
