import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, inject, isDevMode, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { routes } from './app.routes';
import { provideFirebase } from './firebase/firebase.providers';
import { LanguageService } from './i18n/language.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }),
    ),
    provideHttpClient(),
    provideTranslateService({
      loader: provideTranslateHttpLoader({ prefix: 'i18n/', suffix: '.json' }),
      fallbackLang: 'en',
    }),
    // Load the language before the first render, so keys never flash on screen.
    provideAppInitializer(() => inject(LanguageService).init()),
    provideFirebase(),
    // PWA: caches the app (and its translations, same version) for instant and offline starts.
    // Production builds only; VersionService offers the reload when a new version is ready.
    provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode(), registrationStrategy: 'registerWhenStable:30000' }),
  ],
};
