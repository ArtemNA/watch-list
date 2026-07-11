import { Injectable, signal } from '@angular/core';

import en from './en.json';
import ru from './ru.json';
import uk from './uk.json';

export type Lang = 'uk' | 'en' | 'ru';

const STORAGE_KEY = 'watchlist.lang';
// Дефолт для НОВИХ відвідувачів — англійська (Step 10). Свідомо без
// автодетекту navigator.language: збережений вибір у localStorage завжди
// пріоритетніший, тож існуючі юзери (uk) нічого не помітять.
const DEFAULT_LANG: Lang = 'en';
const LANGS: Lang[] = ['uk', 'en', 'ru'];

const dictionaries: Record<Lang, Record<string, string>> = { uk, en, ru };

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly lang = signal<Lang>(this.resolveInitialLang());

  setLang(lang: Lang): void {
    this.lang.set(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  }

  t(key: string, params?: Record<string, string | number>): string {
    const value = dictionaries[this.lang()][key];
    if (value === undefined) {
      console.warn(`[i18n] Missing key "${key}" for lang "${this.lang()}"`);
      return key;
    }
    if (!params) {
      return value;
    }
    return Object.entries(params).reduce(
      (result, [paramKey, paramValue]) =>
        result.replaceAll(`{{${paramKey}}}`, String(paramValue)),
      value,
    );
  }

  private resolveInitialLang(): Lang {
    const stored = localStorage.getItem(STORAGE_KEY);
    return LANGS.includes(stored as Lang) ? (stored as Lang) : DEFAULT_LANG;
  }
}
