import { Component, computed, inject, input, signal } from '@angular/core';
import { Project, projectNameProblem, ProjectColor, Task } from '@loopme/model';
import { TranslatePipe } from '@ngx-translate/core';
import { ProjectsService } from '../data/projects.service';
import { formatClock } from '../ui/clock-time';
import { Marker, PROJECT_COLORS } from '../ui/marker';
import { ToastService } from '../ui/toast.service';
import { TaskForm, TaskFormValue } from './task-form';

/** One project: rename, color, archive, and its tasks. Archive and restore offer Undo. */
@Component({
  selector: 'app-project-card',
  imports: [TranslatePipe, Marker, TaskForm],
  templateUrl: './project-card.html',
  host: { class: 'block rounded-lg border border-line bg-surface p-6' },
})
export class ProjectCard {
  readonly project = input.required<Project>();
  /** The color to show (falls back to one by position when the project has none). */
  readonly color = input.required<ProjectColor>();
  readonly projects = input.required<Project[]>();
  readonly tasks = input.required<Task[]>();

  readonly #service = inject(ProjectsService);
  readonly #toasts = inject(ToastService);

  protected readonly colors = PROJECT_COLORS;
  protected readonly clock = formatClock;
  protected readonly renaming = signal(false);
  protected readonly name = signal('');
  /** `'new'`, a task id being edited, or null. */
  protected readonly taskForm = signal<string | null>(null);
  protected readonly showArchivedTasks = signal(false);
  protected readonly busy = signal(false);
  /** Translation key. */
  protected readonly error = signal<string | null>(null);

  protected readonly ownTasks = computed(() => this.tasks().filter(t => t.projectId === this.project().id));
  protected readonly activeTasks = computed(() => this.ownTasks().filter(t => !t.archived));
  protected readonly archivedTasks = computed(() => this.ownTasks().filter(t => t.archived));
  protected readonly nameProblem = computed(() => projectNameProblem(this.name(), this.projects(), this.project().id));

  protected readonly startRename = (): void => {
    this.name.set(this.project().name);
    this.renaming.set(true);
  };

  readonly #run = async (action: () => Promise<unknown>): Promise<boolean> => {
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
      return true;
    } catch {
      this.error.set('projects.errors.save');
      return false;
    } finally {
      this.busy.set(false);
    }
  };

  protected readonly saveName = async (event: Event): Promise<void> => {
    event.preventDefault();
    if (this.nameProblem() || this.busy()) return;
    if (await this.#run(() => this.#service.updateProject(this.project().id, { name: this.name() }))) this.renaming.set(false);
  };

  protected readonly setColor = (color: ProjectColor): Promise<boolean> =>
    this.#run(() => this.#service.updateProject(this.project().id, { color }));

  protected readonly setArchived = async (archived: boolean): Promise<void> => {
    const { id, name } = this.project();
    if (await this.#run(() => this.#service.updateProject(id, { archived }))) {
      this.#toasts.show({
        message: archived ? 'projects.archivedToast' : 'projects.restoredToast',
        params: { name },
        actionLabel: 'weekView.undo',
        action: () => this.#service.updateProject(id, { archived: !archived }),
      });
    }
  };

  protected readonly saveTask = async (value: TaskFormValue): Promise<void> => {
    const editing = this.taskForm();
    const ok = await this.#run(() =>
      editing && editing !== 'new'
        ? this.#service.updateTask(editing, value)
        : this.#service.createTask(this.project().id, value.name, value.defaultHours),
    );
    if (ok) this.taskForm.set(null);
  };

  protected readonly setTaskArchived = async (task: Task, archived: boolean): Promise<void> => {
    if (await this.#run(() => this.#service.updateTask(task.id, { archived }))) {
      this.#toasts.show({
        message: archived ? 'projects.archivedToast' : 'projects.restoredToast',
        params: { name: task.name },
        actionLabel: 'weekView.undo',
        action: () => this.#service.updateTask(task.id, { archived: !archived }),
      });
    }
  };
}
