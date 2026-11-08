import { afterNextRender, Component, computed, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { Assignment, Project, ProjectColor, Task } from '@loopme/model';
import { TranslatePipe } from '@ngx-translate/core';
import { Marker, PROJECT_COLORS } from './marker';

export type PickerOption =
  | { kind: 'unassign'; id: string }
  | { kind: 'project'; id: string; project: Project; color: ProjectColor }
  | { kind: 'task'; id: string; project: Project; task: Task; color: ProjectColor }
  | { kind: 'create'; id: string; name: string };

export type PickerResult = { assign: Assignment } | { createProject: string };

/** Options for a search: Unassigned, projects each followed by their tasks, then "Create project". */
export const pickerOptions = (
  projects: readonly Project[],
  tasks: readonly Task[],
  query: string,
  allowUnassign: boolean,
): PickerOption[] => {
  const q = query.trim().toLowerCase();
  const matches = (text: string) => !q || text.toLowerCase().includes(q);
  const options: PickerOption[] = [];
  if (allowUnassign && !q) options.push({ kind: 'unassign', id: 'opt-unassign' });

  projects
    .filter(p => !p.archived)
    .forEach((project, i) => {
      const color = project.color ?? PROJECT_COLORS[i % PROJECT_COLORS.length];
      const projectTasks = tasks.filter(t => t.projectId === project.id && !t.archived);
      const taskMatches = projectTasks.filter(t => matches(`${project.name} ${t.name}`));
      if (matches(project.name) || taskMatches.length) options.push({ kind: 'project', id: `opt-p-${project.id}`, project, color });
      for (const task of matches(project.name) ? projectTasks : taskMatches) {
        options.push({ kind: 'task', id: `opt-t-${task.id}`, project, task, color });
      }
    });

  const exists = projects.some(p => p.name.trim().toLowerCase() === q);
  if (q && !exists) options.push({ kind: 'create', id: 'opt-create', name: query.trim() });
  return options;
};

/** Inline, keyboard-first project/task picker: type to filter, ↑/↓ to move, Enter to pick, Esc to close. */
@Component({
  selector: 'app-project-picker',
  imports: [Marker, TranslatePipe],
  host: { class: 'block rounded-lg border border-accent bg-surface p-2' },
  template: `
    <input
      #search
      class="h-10 w-full rounded-md border border-line bg-surface px-3 outline-none focus:border-2 focus:border-accent"
      role="combobox"
      aria-expanded="true"
      aria-autocomplete="list"
      [attr.aria-controls]="listId"
      [attr.aria-activedescendant]="options()[active()]?.id"
      [attr.aria-label]="'picker.search' | translate"
      [placeholder]="'picker.placeholder' | translate"
      [value]="query()"
      (input)="onInput($event)"
      (keydown)="onKeydown($event)" />
    <ul [id]="listId" role="listbox" class="mt-2 max-h-72 overflow-y-auto" [attr.aria-label]="'picker.options' | translate">
      @for (option of options(); track option.id; let i = $index) {
        <li
          [id]="option.id"
          role="option"
          [attr.aria-selected]="i === active()"
          class="flex h-10 cursor-pointer items-center gap-2 rounded-md px-3"
          [class.bg-accent-soft]="i === active()"
          [class.pl-8]="option.kind === 'task'"
          (mousedown)="$event.preventDefault()"
          (mouseenter)="active.set(i)"
          (click)="choose(option)">
          @switch (option.kind) {
            @case ('unassign') {
              <span class="size-3 rounded-full border-2 border-unassigned" aria-hidden="true"></span>
              {{ 'picker.unassigned' | translate }}
            }
            @case ('project') {
              <app-marker [color]="option.color" />
              {{ option.project.name }}
            }
            @case ('task') {
              <app-marker [color]="option.color" />
              <span class="text-muted">{{ option.project.name }} /</span>
              {{ option.task.name }}
            }
            @case ('create') {
              <span class="material-symbols-outlined text-accent" aria-hidden="true">add</span>
              {{ 'picker.create' | translate: { name: option.name } }}
            }
          }
        </li>
      } @empty {
        <li class="px-3 py-2 text-muted">{{ 'picker.noMatches' | translate }}</li>
      }
    </ul>
  `,
})
export class ProjectPicker {
  readonly projects = input.required<Project[]>();
  readonly tasks = input.required<Task[]>();
  readonly allowUnassign = input(true);
  readonly picked = output<PickerResult>();
  readonly cancelled = output<void>();

  protected readonly listId = `picker-${Math.random().toString(36).slice(2, 8)}`;
  protected readonly query = signal('');
  protected readonly active = signal(0);
  protected readonly options = computed(() => pickerOptions(this.projects(), this.tasks(), this.query(), this.allowUnassign()));
  readonly #host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly search = viewChild.required<ElementRef<HTMLInputElement>>('search');

  constructor() {
    afterNextRender(() => {
      this.search().nativeElement.focus({ preventScroll: true });
      this.#host.nativeElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  protected readonly onInput = (event: Event): void => {
    this.query.set((event.target as HTMLInputElement).value);
    this.active.set(0);
  };

  protected readonly onKeydown = (event: KeyboardEvent): void => {
    const count = this.options().length;
    if (event.key === 'ArrowDown' && count) {
      this.active.update(i => (i + 1) % count);
    } else if (event.key === 'ArrowUp' && count) {
      this.active.update(i => (i - 1 + count) % count);
    } else if (event.key === 'Enter') {
      const option = this.options()[this.active()];
      if (option) this.choose(option);
    } else if (event.key === 'Escape') {
      this.cancelled.emit();
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  protected readonly choose = (option: PickerOption): void => {
    if (option.kind === 'unassign') this.picked.emit({ assign: { projectId: null, taskId: null } });
    else if (option.kind === 'project') this.picked.emit({ assign: { projectId: option.project.id, taskId: null } });
    else if (option.kind === 'task') this.picked.emit({ assign: { projectId: option.project.id, taskId: option.task.id } });
    else this.picked.emit({ createProject: option.name });
  };
}
