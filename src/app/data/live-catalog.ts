import { computed, Injectable } from '@angular/core';
import { liveProjects, liveRepoRules, liveTasks } from './live';

/**
 * Projects, tasks and repo rules, kept live once for the whole signed-in session and shared by
 * all pages, so moving between pages doesn't read them again. Provided on the lazy shell route.
 * Pages read `projects()` etc.; `loaded` and `error` cover all three.
 */
@Injectable()
export class LiveCatalog {
  readonly #projects = liveProjects();
  readonly #tasks = liveTasks();
  readonly #rules = liveRepoRules();

  /** Sorted by name. Empty while loading. */
  readonly projects = computed(() => this.#projects.value() ?? []);
  /** Sorted by name. Empty while loading. */
  readonly tasks = computed(() => this.#tasks.value() ?? []);
  /** Sorted by repo. Empty while loading. */
  readonly repoRules = computed(() => this.#rules.value() ?? []);

  readonly projectsLoaded = computed(() => this.#projects.value() !== null);
  readonly tasksLoaded = computed(() => this.#tasks.value() !== null);
  /** Translation key of the first failing listener. */
  readonly error = computed(() => this.#projects.error() ?? this.#tasks.error() ?? this.#rules.error());
}
