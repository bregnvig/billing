import { Component, computed, inject, signal } from '@angular/core';
import { projectNameProblem } from '@loopme/model';
import { TranslatePipe } from '@ngx-translate/core';
import { LiveCatalog } from '../data/live-catalog';
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
  readonly #catalog = inject(LiveCatalog);

  protected readonly loaded = computed(() => this.#catalog.projectsLoaded() && this.#catalog.tasksLoaded());
  protected readonly loadError = this.#catalog.error;
  protected readonly projects = this.#catalog.projects;
  protected readonly tasks = this.#catalog.tasks;
  protected readonly repoRules = this.#catalog.repoRules;
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
