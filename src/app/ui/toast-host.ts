import { Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-host',
  imports: [TranslatePipe],
  template: `
    <div class="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4" role="status" aria-live="polite">
      @if (toasts.current(); as toast) {
        <div class="pointer-events-auto flex items-center gap-4 rounded-lg border border-line bg-raised py-2 pr-2 pl-4 shadow-lg">
          <span>{{ toast.message | translate: toast.params }}</span>
          @if (toast.actionLabel) {
            <button
              type="button"
              class="h-9 rounded-full px-4 font-medium text-accent transition-colors duration-150 hover:bg-accent-soft"
              (click)="toasts.runAction()">
              {{ toast.actionLabel | translate }}
            </button>
          }
          <button
            type="button"
            class="flex size-9 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-surface hover:text-ink"
            [attr.aria-label]="'toast.dismiss' | translate"
            (click)="toasts.dismiss()">
            <span class="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastHost {
  protected readonly toasts = inject(ToastService);
}
