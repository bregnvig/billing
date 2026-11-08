import { Component, computed, input } from '@angular/core';
import { ProjectColor } from '@loopme/model';

/** Marker shape per palette key, so projects never rely on color alone (ui-design skill). */
const SHAPES: Record<ProjectColor, string> = {
  blue: 'M6 1a5 5 0 1 1 0 10A5 5 0 0 1 6 1z', // circle
  orange: 'M1.5 1.5h9v9h-9z', // square
  pink: 'M6 0.5 11.5 6 6 11.5 0.5 6z', // diamond
  brown: 'M1 2h10L6 11z', // triangle down
  green: 'M6 1l5 9H1z', // triangle up
  purple: 'M6 1v10A5 5 0 0 1 6 1z M6 1a5 5 0 0 1 0 10', // half circle
  yellow: 'M4.5 1h3v3.5H11v3H7.5V11h-3V7.5H1v-3h3.5z', // plus
  red: 'M6 0.8l1.5 3.4 3.7.3-2.8 2.4.9 3.6L6 8.6 2.7 10.5l.9-3.6L.8 4.5l3.7-.3z', // star
};

export const PROJECT_COLORS = Object.keys(SHAPES) as ProjectColor[];

@Component({
  selector: 'app-marker',
  host: { class: 'inline-block shrink-0' },
  template: `
    <svg viewBox="0 0 12 12" class="size-3" aria-hidden="true">
      <path [attr.d]="shape()" [style.fill]="fill()" />
    </svg>
  `,
})
export class Marker {
  readonly color = input.required<ProjectColor>();
  protected readonly shape = computed(() => SHAPES[this.color()]);
  protected readonly fill = computed(() => `var(--color-project-${this.color()})`);
}
