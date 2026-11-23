import { Component, computed, inject, input, signal } from '@angular/core';
import { normalizeRepo, Project, RepoRule, Task } from '@loopme/model';
import { TranslatePipe } from '@ngx-translate/core';
import { CommitsService } from '../data/commits.service';
import { ToastService } from '../ui/toast.service';

/**
 * A project's GitHub repositories: commits there assign unassigned time to the project, or to
 * one of its tasks (see model/commits.ts). Shown on the project card.
 */
@Component({
  selector: 'app-repo-rules',
  imports: [TranslatePipe],
  templateUrl: './repo-rules.html',
})
export class RepoRules {
  readonly project = input.required<Project>();
  /** The project's active tasks. */
  readonly tasks = input.required<Task[]>();
  /** All rules (to show which project a repo already belongs to). */
  readonly rules = input.required<RepoRule[]>();
  readonly projects = input.required<Project[]>();

  readonly #service = inject(CommitsService);
  readonly #toasts = inject(ToastService);

  protected readonly own = computed(() =>
    this.rules()
      .filter(r => r.projectId === this.project().id)
      .map(rule => ({ rule, taskName: this.tasks().find(t => t.id === rule.taskId)?.name ?? null })),
  );

  protected readonly repo = signal('');
  protected readonly taskId = signal<string>('');
  protected readonly touched = signal(false);
  protected readonly busy = signal(false);
  /** Translation key of a failed save. */
  protected readonly error = signal<string | null>(null);

  /** Translation key + params of what's wrong with the typed repo, if anything. */
  protected readonly problem = computed((): { key: string; params?: Record<string, string> } | null => {
    if (!this.repo().trim()) return { key: 'projects.repos.errors.required' };
    const repo = normalizeRepo(this.repo());
    if (!repo) return { key: 'projects.repos.errors.format' };
    const existing = this.rules().find(r => r.repo === repo);
    if (existing)
      return { key: 'projects.repos.errors.taken', params: { name: this.projects().find(p => p.id === existing.projectId)?.name ?? '?' } };
    return null;
  });

  protected readonly add = async (event: Event): Promise<void> => {
    event.preventDefault();
    this.touched.set(true);
    const repo = normalizeRepo(this.repo());
    if (this.problem() || !repo || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.#service.addRule(repo, { projectId: this.project().id, taskId: this.taskId() || null });
      this.repo.set('');
      this.taskId.set('');
      this.touched.set(false);
    } catch {
      this.error.set('projects.errors.save');
    } finally {
      this.busy.set(false);
    }
  };

  protected readonly remove = async (rule: RepoRule): Promise<void> => {
    this.error.set(null);
    try {
      await this.#service.removeRule(rule.id);
      this.#toasts.show({
        message: 'projects.repos.removed',
        params: { repo: rule.repo },
        actionLabel: 'weekView.undo',
        action: () => this.#service.addRule(rule.repo, { projectId: rule.projectId, taskId: rule.taskId }),
      });
    } catch {
      this.error.set('projects.errors.save');
    }
  };
}
