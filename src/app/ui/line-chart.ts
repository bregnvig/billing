import { Component, computed, input } from '@angular/core';
import { formatDuration } from './format';

/**
 * Firebase-style comparison chart: solid line = current, dashed = previous, a dot on the
 * latest point, labels only at 0/max and the first/last x value.
 * Values are milliseconds (cumulative hours); `current` may be shorter than `previous`.
 */
@Component({
  selector: 'app-line-chart',
  template: `
    <div class="mt-6 flex gap-2">
      <div class="flex h-28 flex-col justify-between text-right text-xs text-muted tabular-nums" aria-hidden="true">
        <span>{{ format(max()) }}</span>
        <span>0</span>
      </div>
      <div class="relative h-28 flex-1">
        <svg class="absolute inset-0 size-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" y1="0" x2="100" y2="0" class="stroke-line" vector-effect="non-scaling-stroke" />
          <line x1="0" y1="100" x2="100" y2="100" class="stroke-line" vector-effect="non-scaling-stroke" />
          <polyline
            [attr.points]="previousPoints()"
            fill="none"
            class="stroke-muted"
            stroke-width="2"
            stroke-dasharray="4 4"
            vector-effect="non-scaling-stroke" />
          <polyline
            [attr.points]="currentPoints()"
            fill="none"
            class="stroke-accent"
            stroke-width="2"
            stroke-linejoin="round"
            vector-effect="non-scaling-stroke" />
        </svg>
        @if (lastPoint(); as p) {
          <span
            class="absolute size-2 -translate-x-1/2 translate-y-1/2 rounded-full bg-accent"
            [style.left.%]="p.x"
            [style.bottom.%]="100 - p.y"
            aria-hidden="true"></span>
        }
      </div>
    </div>
    <div class="mt-1 flex justify-between pl-10 text-xs text-muted" aria-hidden="true">
      <span>{{ firstLabel() }}</span>
      <span>{{ lastLabel() }}</span>
    </div>
    <p class="mt-3 flex justify-end gap-4 text-xs text-muted" aria-hidden="true">
      <span class="flex items-center gap-1">
        <span class="h-0.5 w-4 bg-accent"></span>
        {{ currentLabel() }}
      </span>
      <span class="flex items-center gap-1">
        <span class="w-4 border-t-2 border-dashed border-muted"></span>
        {{ previousLabel() }}
      </span>
    </p>
    <p class="sr-only">{{ summary() }}</p>
  `,
})
export class LineChart {
  readonly current = input.required<number[]>();
  readonly previous = input.required<number[]>();
  /** Number of x positions (e.g. days in the longer month). */
  readonly length = input.required<number>();
  readonly firstLabel = input.required<string>();
  readonly lastLabel = input.required<string>();
  readonly currentLabel = input.required<string>();
  readonly previousLabel = input.required<string>();
  readonly summary = input.required<string>();
  protected readonly format = formatDuration;

  protected readonly max = computed(() => {
    const hour = 3_600_000;
    const top = Math.max(hour, ...this.current(), ...this.previous());
    return Math.ceil(top / (10 * hour)) * 10 * hour; // round up to 10h steps
  });

  readonly #points = (values: number[]) =>
    values.map((v, i) => ({
      x: this.length() > 1 ? (i / (this.length() - 1)) * 100 : 0,
      y: 100 - (v / this.max()) * 100,
    }));

  protected readonly currentPoints = computed(() =>
    this.#points(this.current())
      .map(p => `${p.x},${p.y}`)
      .join(' '),
  );
  protected readonly previousPoints = computed(() =>
    this.#points(this.previous())
      .map(p => `${p.x},${p.y}`)
      .join(' '),
  );
  protected readonly lastPoint = computed(() => this.#points(this.current()).at(-1) ?? null);
}
