import { Component, input } from '@angular/core';

/**
 * Firebase-style metric card: icon + title, label with muted qualifier, a big number with a
 * muted delta, then projected content (badges, chart).
 */
@Component({
  selector: 'app-metric-card',
  host: { class: 'flex flex-col rounded-lg border border-line bg-surface p-6' },
  template: `
    <h2 class="flex items-center gap-2 text-base font-medium">
      <span class="material-symbols-outlined text-muted" aria-hidden="true">{{ icon() }}</span>
      {{ title() }}
      @if (subtitle()) {
        <span class="ml-auto text-sm font-normal text-muted">{{ subtitle() }}</span>
      }
    </h2>
    <p class="mt-4">
      {{ label() }}
      @if (labelQualifier()) {
        <span class="text-muted">({{ labelQualifier() }})</span>
      }
    </p>
    <p class="mt-1 flex flex-wrap items-baseline gap-x-2">
      <span class="text-xl tabular-nums" [class.text-muted]="muted()">{{ value() }}</span>
      @if (delta()) {
        <span class="text-xs text-muted tabular-nums" [attr.title]="deltaLabel()">
          {{ delta() }}
          <span class="sr-only">{{ deltaLabel() }}</span>
          <span aria-hidden="true">{{ deltaLabel() }}</span>
        </span>
      }
    </p>
    <ng-content />
  `,
})
export class MetricCard {
  readonly icon = input.required<string>();
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly label = input.required<string>();
  readonly labelQualifier = input<string>();
  readonly value = input.required<string>();
  /** Show the value muted (e.g. 0:00 on an empty day). */
  readonly muted = input(false);
  readonly delta = input<string>();
  readonly deltaLabel = input<string>();
}
