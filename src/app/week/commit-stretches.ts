import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IsoDate, Project, RepoRule, Task, toIsoDate } from '@loopme/model';
import { TranslatePipe } from '@ngx-translate/core';
import { DayCommits, dayStretches } from '../data/commit-insight';
import { LanguageService } from '../i18n/language.service';
import { formatTime, formatWeekdayShort } from '../ui/format';
import { Marker, PROJECT_COLORS } from '../ui/marker';

/**
 * The week view's Commits panel for one day: each stretch of the day as the commit matching sees
 * it (time, what it decided or why it couldn't, and the commits behind it).
 */
@Component({
  selector: 'app-commit-stretches',
  imports: [TranslatePipe, Marker, RouterLink],
  templateUrl: './commit-stretches.html',
  host: { class: 'block rounded-md bg-raised p-4' },
})
export class CommitStretches {
  readonly date = input.required<IsoDate>();
  readonly day = input.required<DayCommits>();
  readonly rules = input.required<RepoRule[]>();
  readonly projects = input.required<Project[]>();
  readonly tasks = input.required<Task[]>();
  readonly now = input.required<Date>();

  readonly #locale = inject(LanguageService).locale;

  /** Time, with the weekday when it's on another day than the one shown. */
  readonly #time = (d: Date): string =>
    toIsoDate(d) === this.date() ? formatTime(d) : `${formatWeekdayShort(d, this.#locale())} ${formatTime(d)}`;

  protected readonly fetched = computed(() => this.day().commits !== null);

  protected readonly stretches = computed(() =>
    dayStretches(this.date(), this.day(), this.rules(), this.now()).map((s, i) => {
      const project = s.assignment && this.projects().find(p => p.id === s.assignment!.projectId);
      const task = s.assignment?.taskId ? this.tasks().find(t => t.id === s.assignment!.taskId) : undefined;
      const index = project ? this.projects().indexOf(project) : 0;
      return {
        key: `${i}-${s.start.getTime()}`,
        time: `${this.#time(s.start)}–${this.#time(s.end)}`,
        kind: s.kind,
        label: project ? (task ? `${project.name} / ${task.name}` : project.name) : null,
        color: project ? (project.color ?? PROJECT_COLORS[index % PROJECT_COLORS.length]) : null,
        reasonKey: `overview.needsProject.reason.${s.kind}`,
        repos: s.repos.join(', '),
        commits: s.commits.map(c => ({ key: c.sha, time: this.#time(c.at), repo: c.repo, name: c.repo.split('/')[1] })),
      };
    }),
  );
}
