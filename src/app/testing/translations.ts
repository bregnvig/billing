import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import en from '../../../public/i18n/en.json';

/** Add to `providers` in component tests. */
export const provideTestTranslations = () => provideTranslateService({ fallbackLang: 'en' });

/** Call after `configureTestingModule`: loads the real English file (no HTTP). */
export const useEnglish = (): void => {
  const translate = TestBed.inject(TranslateService);
  translate.setTranslation('en', en);
  translate.use('en');
};
