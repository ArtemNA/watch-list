import { isFallbackLanguage, languageForUi } from './tmdb-language';

describe('languageForUi', () => {
  it('maps uk to uk-UA', () => {
    expect(languageForUi('uk')).toBe('uk-UA');
  });

  it('maps en to en-US', () => {
    expect(languageForUi('en')).toBe('en-US');
  });

  it('maps ru to ru-RU', () => {
    expect(languageForUi('ru')).toBe('ru-RU');
  });
});

describe('isFallbackLanguage', () => {
  it('recognizes en-US as the fallback language', () => {
    expect(isFallbackLanguage('en-US')).toBe(true);
  });

  it('does not treat uk-UA or ru-RU as the fallback language', () => {
    expect(isFallbackLanguage('uk-UA')).toBe(false);
    expect(isFallbackLanguage('ru-RU')).toBe(false);
  });
});
