import { TestBed } from '@angular/core/testing';

import { I18nService } from './i18n.service';

describe('I18nService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to uk', () => {
    const service = TestBed.inject(I18nService);

    expect(service.lang()).toBe('uk');
    expect(service.t('app.title')).toBe('WatchList');
  });

  it('switches language and translates accordingly', () => {
    const service = TestBed.inject(I18nService);

    expect(service.t('shell.theme.label')).toBe('Тема');

    service.setLang('en');

    expect(service.lang()).toBe('en');
    expect(service.t('shell.theme.label')).toBe('Theme');
  });

  it('persists the chosen language across instances', () => {
    TestBed.inject(I18nService).setLang('en');

    TestBed.resetTestingModule();
    const service = TestBed.inject(I18nService);

    expect(service.lang()).toBe('en');
  });

  it('returns the key itself and warns when the key is missing', () => {
    const service = TestBed.inject(I18nService);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = service.t('does.not.exist');

    expect(result).toBe('does.not.exist');
    expect(warnSpy).toHaveBeenCalledOnce();

    warnSpy.mockRestore();
  });
});
