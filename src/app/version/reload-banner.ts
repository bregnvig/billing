import { Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { VersionService } from './version.service';

/** Offers a reload when a new version is deployed while the app is open. */
@Component({
  selector: 'app-reload-banner',
  imports: [TranslatePipe],
  template: `
    @if (version.updateAvailable()) {
      <section
        class="fixed inset-x-4 top-16 z-50 mx-auto flex max-w-xl items-center gap-3 rounded-lg border border-line bg-surface py-2 pr-2 pl-4 shadow-lg md:top-4"
        role="status">
        <span class="material-symbols-outlined text-accent" aria-hidden="true">info</span>
        <p class="flex-1">{{ 'version.available' | translate }}</p>
        <button
          type="button"
          class="h-9 rounded-full px-3 font-medium text-accent transition-colors duration-150 hover:bg-raised"
          (click)="version.reload()">
          {{ 'version.reload' | translate }}
        </button>
        <button
          type="button"
          class="flex size-9 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-raised hover:text-ink"
          [attr.aria-label]="'version.dismiss' | translate"
          [title]="'version.dismiss' | translate"
          (click)="version.dismiss()">
          <span class="material-symbols-outlined" aria-hidden="true">close</span>
        </button>
      </section>
    }
  `,
})
export class ReloadBanner {
  protected readonly version = inject(VersionService);
}
