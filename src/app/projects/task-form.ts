import { afterNextRender, Component, ElementRef, input, OnInit, output, signal, viewChild } from '@angular/core';
import { form, FormField, validate } from '@angular/forms/signals';
import { DefaultHours, defaultHoursProblem, Task, taskNameProblem, toDefaultHours } from '@loopme/model';
import { TranslatePipe } from '@ngx-translate/core';
import { formatClock, parseClock } from '../ui/clock-time';

export interface TaskFormValue {
  name: string;
  defaultHours: DefaultHours | null;
}

/** Inline form to add or edit a task: name plus optional default hours (pre-fill for manual periods). */
@Component({
  selector: 'app-task-form',
  imports: [FormField, TranslatePipe],
  templateUrl: './task-form.html',
  host: { class: 'block' },
})
export class TaskForm implements OnInit {
  readonly projectId = input.required<string>();
  /** All tasks, for the duplicate-name check. */
  readonly tasks = input.required<Task[]>();
  /** The task being edited; omit to add a new one. */
  readonly task = input<Task>();
  readonly busy = input(false);
  readonly saved = output<TaskFormValue>();
  readonly cancelled = output<void>();

  readonly #model = signal({ name: '', start: '', end: '' });
  protected readonly fields = form(this.#model, path => {
    validate(path.name, ({ value }) => {
      const problem = taskNameProblem(value(), this.projectId(), this.tasks(), this.task()?.id);
      return problem ? { kind: problem, message: `projects.errors.name.${problem}` } : null;
    });
    validate(path.start, ({ value }) =>
      value() && parseClock(value()) === null ? { kind: 'format', message: 'projects.errors.format' } : null,
    );
    validate(path.end, ({ value, valueOf }) => {
      if (value() && parseClock(value()) === null) return { kind: 'format', message: 'projects.errors.format' };
      const start = valueOf(path.start) ? parseClock(valueOf(path.start)) : null;
      const end = value() ? parseClock(value()) : null;
      const problem = defaultHoursProblem(start, end);
      return problem ? { kind: problem, message: `projects.errors.hours.${problem}` } : null;
    });
  });

  protected readonly nameInput = viewChild.required<ElementRef<HTMLInputElement>>('nameInput');

  constructor() {
    afterNextRender(() => this.nameInput().nativeElement.focus());
  }

  ngOnInit(): void {
    const task = this.task();
    if (task) {
      this.#model.set({
        name: task.name,
        start: task.defaultHours ? formatClock(task.defaultHours.start) : '',
        end: task.defaultHours ? formatClock(task.defaultHours.end) : '',
      });
    }
  }

  /** On blur: `830` → `08:30`. */
  protected readonly normalize = (field: 'start' | 'end'): void => {
    const minutes = parseClock(this.#model()[field]);
    if (minutes !== null) this.#model.update(m => ({ ...m, [field]: formatClock(minutes) }));
  };

  protected readonly submit = (event: Event): void => {
    event.preventDefault();
    this.fields.name().markAsTouched();
    this.fields.end().markAsTouched();
    if (!this.fields().valid() || this.busy()) return;
    const { name, start, end } = this.#model();
    this.saved.emit({
      name,
      defaultHours: toDefaultHours(start ? parseClock(start) : null, end ? parseClock(end) : null),
    });
  };

  protected readonly onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelled.emit();
    }
  };
}
