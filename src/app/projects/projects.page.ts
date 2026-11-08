import { Component, computed, inject, signal } from '@angular/core';
import { projectNameProblem } from '@loopme/model';
import { TranslatePipe } from '@ngx-translate/core';
import { liveProjects, liveTasks } from '../data/live';
import { ProjectsService } from '../data/projects.service';
import { PROJECT_COLORS } from '../ui/marker';
import { ProjectCard } from './project-card';

/** Projects and their tasks: create, rename, color, archive, default hours. */
@Component({
  selector: 'app-projects-page',
  imports: [TranslatePipe, ProjectCard],
  templateUrl: './projects.page.html',
})
export class ProjectsPage {
  readonly #service = inject(ProjectsService);
  readonly #projects = liveProjects();
  readonly #tasks = liveTasks();

  protected readonly loaded = computed(() => this.#projects.value() !== null && this.#tasks.value() !== null);
  protected readonly loadError = computed(() => this.#projects.error() ?? this.#tasks.error());
  protected readonly projects = computed(() => this.#projects.value() ?? []);
  protected readonly tasks = computed(() => this.#tasks.value() ?? []);
  /** Each project with the color it's shown in (by position when it has none). */
  readonly #withColors = computed(() =>
    this.projects().map((project, i) => ({ project, color: project.color ?? PROJECT_COLORS[i % PROJECT_COLORS.length] })),
  );
  protected readonly active = computed(() => this.#withColors().filter(p => !p.project.archived));
  protected readonly archived = computed(() => this.#withColors().filter(p => p.project.archived));
  protected readonly showArchived = signal(false);

  protected readonly newName = signal('');
  protected readonly touched = signal(false);
  protected readonly creating = signal(false);
  /** Translation key. */
  protected readonly createError = signal<string | null>(null);
  protected readonly newNameProblem = computed(() => projectNameProblem(this.newName(), this.projects()));

  protected readonly create = async (event: Event): Promise<void> => {
    event.preventDefault();
    this.touched.set(true);
    if (this.newNameProblem() || this.creating()) return;
    this.creating.set(true);
    this.createError.set(null);
    try {
      await this.#service.createProject(this.newName(), this.projects());
      this.newName.set('');
      this.touched.set(false);
    } catch {
      this.createError.set('projects.errors.save');
    } finally {
      this.creating.set(false);
    }
  };
}
