import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-week-page',
  imports: [TranslatePipe],
  template: `
    <div class="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <h1 class="text-3xl font-normal">{{ 'week.title' | translate }}</h1>
      <p class="mt-2 text-muted">{{ 'week.placeholder' | translate }}</p>
    </div>
  `,
})
export class WeekPage {}
