import { afterNextRender, Component, computed, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { form, FormField, required, validate } from '@angular/forms/signals';
import { overlapping, Period, PeriodType, Project, ProjectColor, Task } from '@loopme/model';
import { TranslatePipe } from '@ngx-translate/core';
import { atClock, formatClock, parseClock } from '../ui/clock-time';
import { formatTime } from '../ui/format';
import { Marker, PROJECT_COLORS } from '../ui/marker';
import { PickerResult, ProjectPicker } from '../ui/project-picker';

export interface NewPeriod {
  start: Date;
  end: Date;
  type: PeriodType;
  /** `null` = leave unassigned. */
  project: PickerResult | null;
}

/** Inline form for a manual period on one day. */
@Component({
  selector: 'app-add-period-form',
  imports: [FormField, TranslatePipe, Marker, ProjectPicker],
  templateUrl: './add-period-form.html',
  host: { class: 'block rounded-lg border border-accent bg-surface p-4' },
})
export class AddPeriodForm {
  /** Local midnight of the day. */
  readonly day = input.required<Date>();
  /** The day's existing periods, for the overlap warning. */
  readonly periods = input.required<Pick<Period, 'start' | 'end'>[]>();
  readonly projects = input.required<Project[]>();
  readonly tasks = input.required<Task[]>();
  readonly now = input.required<Date>();
  readonly busy = input(false);
  readonly saved = output<NewPeriod>();
  readonly cancelled = output<void>();

  readonly #model = signal({ start: '', end: '' });
  protected readonly times = form(this.#model, path => {
    required(path.start, { message: 'addPeriod.errors.startRequired' });
    required(path.end, { message: 'addPeriod.errors.endRequired' });
    validate(path.start, ({ value }) =>
      value() && parseClock(value()) === null ? { kind: 'format', message: 'addPeriod.errors.format' } : null,
    );
    validate(path.end, ({ value, valueOf }) => {
      if (!value()) return null;
      const end = parseClock(value());
      if (end === null) return { kind: 'format', message: 'addPeriod.errors.format' };
      const start = parseClock(valueOf(path.start));
      if (start !== null && end <= start) return { kind: 'order', message: 'addPeriod.errors.endBeforeStart' };
      if (atClock(this.day(), end) > this.now()) return { kind: 'future', message: 'addPeriod.errors.future' };
      return null;
    });
  });

  /** Set on the first save attempt: "required" errors only show from then on. */
  protected readonly submitted = signal(false);

  /**
   * Error to show for a field (translation key). Format/order errors show once you leave the field;
   * "required" only after a save attempt, so choosing a task first (which fills in the times) isn't nagged.
   */
  protected readonly errorFor = (field: 'start' | 'end'): string | null => {
    const state = this.times[field]();
    const error = state.errors()[0];
    if (!error) return null;
    return this.submitted() || (state.touched() && error.kind !== 'required') ? (error.message ?? null) : null;
  };

  protected readonly type = signal<PeriodType>('work');
  protected readonly project = signal<PickerResult | null>(null);
  protected readonly pickingProject = signal(false);

  protected readonly startInput = viewChild.required<ElementRef<HTMLInputElement>>('startInput');

  constructor() {
    afterNextRender(() => this.startInput().nativeElement.focus());
  }

  readonly #range = computed(() => {
    const start = parseClock(this.#model().start);
    const end = parseClock(this.#model().end);
    return start !== null && end !== null && end > start ? { start: atClock(this.day(), start), end: atClock(this.day(), end) } : null;
  });

  /** Existing periods the new one would overlap: a warning, not an error (corrections may overlap). */
  protected readonly overlaps = computed(() => {
    const range = this.#range();
    return range
      ? overlapping(this.periods(), range.start, range.end, this.now()).map(
          p => `${formatTime(p.start)}–${formatTime(p.end ?? this.now())}`,
        )
      : [];
  });

  protected readonly projectLabel = computed((): { name: string; color: ProjectColor } | null => {
    const chosen = this.project();
    if (!chosen) return null;
    if ('createProject' in chosen)
      return { name: chosen.createProject, color: PROJECT_COLORS[this.projects().length % PROJECT_COLORS.length] };
    const index = this.projects().findIndex(p => p.id === chosen.assign.projectId);
    const project = this.projects()[index];
    if (!project) return null;
    const task = this.tasks().find(t => t.id === chosen.assign.taskId);
    return {
      name: task ? `${project.name} / ${task.name}` : project.name,
      color: project.color ?? PROJECT_COLORS[index % PROJECT_COLORS.length],
    };
  });

  /** On blur: `830` → `08:30`. */
  protected readonly normalize = (field: 'start' | 'end'): void => {
    const minutes = parseClock(this.#model()[field]);
    if (minutes !== null) this.#model.update(m => ({ ...m, [field]: formatClock(minutes) }));
  };

  protected readonly pickProject = (result: PickerResult): void => {
    this.project.set('assign' in result && result.assign.projectId === null ? null : result);
    this.pickingProject.set(false);
    // A task's default hours fill in the times, unless you've already typed some.
    const hours = 'assign' in result ? this.tasks().find(t => t.id === result.assign.taskId)?.defaultHours : null;
    const { start, end } = this.#model();
    if (hours && !start && !end) this.#model.set({ start: formatClock(hours.start), end: formatClock(hours.end) });
  };

  protected readonly submit = (event: Event): void => {
    event.preventDefault();
    this.submitted.set(true);
    this.times.start().markAsTouched();
    this.times.end().markAsTouched();
    const range = this.#range();
    if (!this.times().valid() || !range || this.busy()) return;
    this.saved.emit({ ...range, type: this.type(), project: this.type() === 'break' ? null : this.project() });
  };

  protected readonly onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && !this.pickingProject()) {
      event.preventDefault();
      this.cancelled.emit();
    }
  };
}
