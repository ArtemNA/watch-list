import type { Lang } from '../i18n/i18n.service';

const FALLBACK_LANGUAGE = 'en-US';

/** Мова TMDB-запиту = поточна мова UI; кирилична розкладка запиту її не змінює. */
export function languageForUi(lang: Lang): string {
  return lang === 'uk' ? 'uk-UA' : FALLBACK_LANGUAGE;
}

export function isFallbackLanguage(language: string): boolean {
  return language === FALLBACK_LANGUAGE;
}
