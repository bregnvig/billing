import { Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ProjectColor } from '@loopme/model';
import { formatDuration, formatTime } from '../ui/format';

export interface TimelinePeriod {
  id: string;
  start: Date;
  /** `null` = running. */
  end: Date | null;
  type: 'work' | 'break';
  /** `null` = unassigned. */
  color: ProjectColor | null;
  /** Project name, e.g. `Acme / API`; `null` when `labelKey` applies. */
  label: string | null;
  /** Translation key used when there's no project name (unassigned, unknown project). */
  labelKey: string | null;
}

const HOUR = 3_600_000;

/** One day as a horizontal track (default 07:00-19:00, stretched to fit the periods). */
@Component({
  selector: 'app-day-timeline',
  imports: [TranslatePipe],
  styleUrl: './day-timeline.scss',
  template: `
    <div
      class="relative mt-6 h-8 rounded-sm bg-raised"
      role="list"
      [attr.aria-label]="
        periods().length ? ('timeline.periods' | translate: { count: periods().length }) : ('timeline.noPeriods' | translate)
      ">
      @for (bar of bars(); track bar.id) {
        <div
          role="listitem"
          class="bar absolute inset-y-1 rounded-sm"
          [class.bar-break]="bar.type === 'break'"
          [class.bar-unassigned]="bar.type === 'work' && !bar.color"
          [style.left.%]="bar.left"
          [style.width.%]="bar.width"
          [style.background-color]="bar.color ? 'var(--color-project-' + bar.color + ')' : null"
          [attr.aria-label]="
            'timeline.period'
              | translate
                : {
                    label: bar.label ?? (bar.labelKey! | translate),
                    start: bar.startText,
                    end: bar.endText ?? ('timeline.nowRunning' | translate),
                    duration: bar.duration,
                  }
          "
          [attr.title]="
            'timeline.period'
              | translate
                : {
                    label: bar.label ?? (bar.labelKey! | translate),
                    start: bar.startText,
                    end: bar.endText ?? ('timeline.nowRunning' | translate),
                    duration: bar.duration,
                  }
          ">
          @if (bar.running) {
            <span class="running-dot absolute -right-1 top-1/2 size-2 -translate-y-1/2 rounded-full bg-running"></span>
          }
        </div>
      }
      @if (nowLeft() !== null) {
        <div class="absolute -inset-y-1 w-px bg-ink" [style.left.%]="nowLeft()" aria-hidden="true"></div>
      }
    </div>
    <div class="relative mt-1 h-4 text-xs text-muted tabular-nums" aria-hidden="true">
      @for (tick of ticks(); track tick.label) {
        <span class="absolute -translate-x-1/2" [style.left.%]="tick.left">{{ tick.label }}</span>
      }
    </div>
  `,
})
export class DayTimeline {
  readonly day = input.required<Date>(); // local midnight
  readonly periods = input.required<TimelinePeriod[]>();
  readonly now = input.required<Date>();

  /** Visible hours: 07-19 by default, widened to whole hours around periods and "now". */
  readonly #span = computed(() => {
    const midnight = this.day().getTime();
    const isToday = this.now().getTime() - midnight < 24 * HOUR && this.now().getTime() >= midnight;
    const times = this.periods().flatMap(p => [p.start, p.end ?? this.now()]);
    if (isToday) times.push(this.now());
    const hours = times.map(t => (t.getTime() - midnight) / HOUR);
    const from = Math.max(0, Math.min(7, Math.floor(Math.min(...hours, 7))));
    const to = Math.min(24, Math.max(19, Math.ceil(Math.max(...hours, 19))));
    return { from, to, midnight, isToday };
  });

  readonly #pct = (t: Date): number => {
    const { from, to, midnight } = this.#span();
    const hours = (t.getTime() - midnight) / HOUR;
    return Math.min(100, Math.max(0, ((hours - from) / (to - from)) * 100));
  };

  protected readonly bars = computed(() =>
    this.periods().map(p => {
      const end = p.end ?? this.now();
      const left = this.#pct(p.start);
      const duration = formatDuration(end.getTime() - p.start.getTime());

      return {
        ...p,
        left,
        width: Math.max(0.5, this.#pct(end) - left),
        running: p.end === null,
        label: p.type === 'break' ? null : p.label,
        labelKey: p.type === 'break' ? 'timeline.break' : p.labelKey,
        startText: formatTime(p.start),
        endText: p.end ? formatTime(p.end) : null,
        duration,
      };
    }),
  );

  protected readonly nowLeft = computed(() => (this.#span().isToday ? this.#pct(this.now()) : null));

  protected readonly ticks = computed(() => {
    const { from, to } = this.#span();
    const step = to - from > 12 ? 3 : 2;
    const ticks = [];
    for (let h = Math.ceil(from / step) * step; h <= to; h += step) {
      ticks.push({
        label: `${String(h).padStart(2, '0')}:00`,
        left: ((h - from) / (to - from)) * 100,
      });
    }
    return ticks;
  });
}
