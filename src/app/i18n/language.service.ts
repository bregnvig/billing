import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

export type Language = 'en' | 'da';
export type Locale = 'en-GB' | 'da-DK';

/** Shown in their own language, so they're recognisable whichever language is active. */
export const LANGUAGES: readonly { code: Language; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'da', name: 'Dansk' },
];

const LOCALES: Record<Language, Locale> = { en: 'en-GB', da: 'da-DK' };

/** Keep in sync with the inline script in src/index.html. */
const STORAGE_KEY = 'loopme.lang';

const isLanguage = (value: unknown): value is Language => value === 'en' || value === 'da';

/** Saved choice, else the browser language (Danish browsers get Danish), else English. */
const initialLanguage = (): Language => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLanguage(saved)) return saved;
  } catch {
    // Storage blocked: fall through to the browser language.
  }
  return navigator.languages?.some(l => l.toLowerCase().startsWith('da')) ? 'da' : 'en';
};

/** UI language (ngx-translate) and the matching locale for dates. Stored per device. */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  readonly #translate = inject(TranslateService);
  readonly #root = inject(DOCUMENT).documentElement;

  readonly language = computed<Language>(() => {
    const current = this.#translate.currentLang();
    return isLanguage(current) ? current : 'en';
  });
  /** For `Intl` date formatting. */
  readonly locale = computed<Locale>(() => LOCALES[this.language()]);

  constructor() {
    effect(() => (this.#root.lang = this.language()));
  }

  /** Loads the initial language before the app renders (see app.config.ts). */
  readonly init = (): Promise<unknown> => firstValueFrom(this.#translate.use(initialLanguage()));

  readonly set = async (language: Language): Promise<void> => {
    await firstValueFrom(this.#translate.use(language));
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Storage blocked: the language still applies for this session.
    }
  };
}
