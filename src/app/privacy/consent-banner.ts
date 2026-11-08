import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ConsentService } from './consent.service';

/** Shown until a choice is made. Allow and decline are equally prominent (GDPR). */
@Component({
  selector: 'app-consent-banner',
  imports: [TranslatePipe, RouterLink],
  template: `
    @if (consent.choice() === null) {
      <section
        class="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-2xl rounded-lg border border-line bg-surface p-5 shadow-lg"
        role="region"
        aria-labelledby="consent-title">
        <h2 id="consent-title" class="flex items-center gap-2 text-base font-medium">
          <span class="material-symbols-outlined text-muted" aria-hidden="true">cookie</span>
          {{ 'consent.title' | translate }}
        </h2>
        <p class="mt-2 text-muted">{{ 'consent.text' | translate }}</p>
        <div class="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="h-10 rounded-full border border-line bg-raised px-5 font-medium transition-colors duration-150 hover:bg-line"
            (click)="consent.set('granted')">
            {{ 'consent.allow' | translate }}
          </button>
          <button
            type="button"
            class="h-10 rounded-full border border-line bg-raised px-5 font-medium transition-colors duration-150 hover:bg-line"
            (click)="consent.set('denied')">
            {{ 'consent.decline' | translate }}
          </button>
          <a routerLink="/settings" fragment="privacy" class="ml-auto text-sm text-accent hover:underline">
            {{ 'consent.more' | translate }}
          </a>
        </div>
      </section>
    }
  `,
})
export class ConsentBanner {
  protected readonly consent = inject(ConsentService);
}
