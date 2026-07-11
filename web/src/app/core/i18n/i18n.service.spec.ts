import { TestBed } from '@angular/core/testing';

import en from './en.json';
import { I18nService } from './i18n.service';
import ru from './ru.json';
import uk from './uk.json';

describe('I18nService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to en for a new visitor (Step 10: en became the default, was uk)', () => {
    const service = TestBed.inject(I18nService);

    expect(service.lang()).toBe('en');
    expect(service.t('app.title')).toBe('WatchList');
  });

  it('switches language and translates accordingly, including ru', () => {
    const service = TestBed.inject(I18nService);

    expect(service.t('shell.theme.label')).toBe('Theme');

    service.setLang('uk');
    expect(service.lang()).toBe('uk');
    expect(service.t('shell.theme.label')).toBe('Тема');

    service.setLang('ru');
    expect(service.lang()).toBe('ru');
    expect(service.t('shell.theme.label')).toBe('Тема');
    expect(service.t('nav.search')).toBe('Поиск');
  });

  it('persists the chosen language across instances', () => {
    TestBed.inject(I18nService).setLang('uk');

    TestBed.resetTestingModule();
    const service = TestBed.inject(I18nService);

    expect(service.lang()).toBe('uk');
  });

  it('keeps an existing stored choice on reload — a new default never overrides it', () => {
    localStorage.setItem('watchlist.lang', 'uk');

    const service = TestBed.inject(I18nService);

    expect(service.lang()).toBe('uk');
  });

  it('returns the key itself and warns when the key is missing', () => {
    const service = TestBed.inject(I18nService);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = service.t('does.not.exist');

    expect(result).toBe('does.not.exist');
    expect(warnSpy).toHaveBeenCalledOnce();

    warnSpy.mockRestore();
  });

  it('has an identical key set across uk/en/ru dictionaries (guards against a missing key in a future step)', () => {
    const ukKeys = Object.keys(uk).sort();
    const enKeys = Object.keys(en).sort();
    const ruKeys = Object.keys(ru).sort();

    expect(enKeys).toEqual(ukKeys);
    expect(ruKeys).toEqual(ukKeys);
  });
});
