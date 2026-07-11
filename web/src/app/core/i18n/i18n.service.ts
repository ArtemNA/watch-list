import { Injectable, signal } from '@angular/core';

import en from './en.json';
import uk from './uk.json';

export type Lang = 'uk' | 'en';

const STORAGE_KEY = 'watchlist.lang';
const DEFAULT_LANG: Lang = 'uk';

const dictionaries: Record<Lang, Record<string, string>> = { uk, en };

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
    return stored === 'uk' || stored === 'en' ? stored : DEFAULT_LANG;
  }
}
