import { Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { formatDuration } from '../ui/format';

export interface WeekBarDay {
  /** `Mon` */
  short: string;
  /** `Monday 2 November`, for screen readers. */
  long: string;
  work: number;
  lastWeek: number;
  isToday: boolean;
  isFuture: boolean;
}

const EIGHT_HOURS = 8 * 3_600_000;

/** Bars per weekday: solid = this week, dashed outline = same day last week (ui-design charts). */
@Component({
  selector: 'app-week-bars',
  imports: [TranslatePipe],
  template: `
    <ul class="mt-6 flex h-36 items-end gap-2" [attr.aria-label]="'weekBars.label' | translate">
      @for (day of scaled(); track day.short) {
        <li class="flex h-full flex-1 flex-col items-center justify-end gap-1">
          <span class="text-xs text-muted tabular-nums" aria-hidden="true">
            {{ day.work > 0 ? format(day.work) : '' }}
          </span>
          <div class="relative w-full max-w-10 flex-1">
            @if (day.lastWeekPct > 0) {
              <div
                class="absolute inset-x-0 bottom-0 rounded-t-sm border border-dashed border-muted"
                [style.height.%]="day.lastWeekPct"></div>
            }
            <div
              class="absolute inset-x-1 bottom-0 rounded-t-sm bg-accent"
              [class.opacity-50]="!day.isToday"
              [style.height.%]="day.workPct"></div>
          </div>
          <span
            class="text-xs"
            [class.font-medium]="day.isToday"
            [class.text-accent]="day.isToday"
            [class.text-muted]="!day.isToday"
            aria-hidden="true">
            {{ day.short }}
          </span>
          <span class="sr-only">
            {{ 'weekBars.day' | translate: { day: day.long, work: format(day.work), lastWeek: format(day.lastWeek) } }}
          </span>
        </li>
      }
    </ul>
    <p class="mt-3 flex justify-end gap-4 text-xs text-muted" aria-hidden="true">
      <span class="flex items-center gap-1">
        <span class="h-2 w-3 rounded-sm bg-accent"></span>
        {{ 'weekBars.thisWeek' | translate }}
      </span>
      <span class="flex items-center gap-1">
        <span class="h-2 w-3 rounded-sm border border-dashed border-muted"></span>
        {{ 'weekBars.lastWeek' | translate }}
      </span>
    </p>
  `,
})
export class WeekBars {
  readonly days = input.required<WeekBarDay[]>();
  protected readonly format = formatDuration;

  protected readonly scaled = computed(() => {
    const max = Math.max(EIGHT_HOURS, ...this.days().flatMap(d => [d.work, d.lastWeek]));
    return this.days().map(d => ({
      ...d,
      workPct: (d.work / max) * 100,
      lastWeekPct: (d.lastWeek / max) * 100,
    }));
  });
}
