import type { Lang } from '../i18n/i18n.service';

const FALLBACK_LANGUAGE = 'en-US';

/** Мова TMDB-запиту = поточна мова UI; кирилична розкладка запиту її не змінює. */
export function languageForUi(lang: Lang): string {
  if (lang === 'uk') {
    return 'uk-UA';
  }
  if (lang === 'ru') {
    return 'ru-RU';
  }
  return FALLBACK_LANGUAGE;
}

export function isFallbackLanguage(language: string): boolean {
  return language === FALLBACK_LANGUAGE;
}
