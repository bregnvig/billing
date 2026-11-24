import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { addDays, COMMIT_LOOKAHEAD_DAYS, entryDurationMs, IsoDate, Project, startOfWeek, Task, TimeEntry, toIsoDate } from '@loopme/model';
import { TranslatePipe } from '@ngx-translate/core';
import { commitDayMap, dayCommits, reasonText, unassignedReason } from '../data/commit-insight';
import { CommitsService, syncToast } from '../data/commits.service';
import { liveCommitDays } from '../data/live';
import { LiveCatalog } from '../data/live-catalog';
import { ProjectsService } from '../data/projects.service';
import { TimeEntriesService } from '../data/time-entries.service';
import { LanguageService } from '../i18n/language.service';
import { formatDay, formatDuration, formatTime } from '../ui/format';
import { pickTarget } from '../ui/pick-target';
import { PickerResult, ProjectPicker } from '../ui/project-picker';
import { ToastService } from '../ui/toast.service';
import { dayStart } from './dates';
import { DayTimeline, timelinePeriods } from './day-timeline';
import { unassignedPeriodsOn } from './previous-day';

/**
 * The overview's card for the previous day you worked, shown while it has unassigned time: its
 * timeline, each unassigned period with why the commits didn't assign it, and Assign all / Sync.
 */
@Component({
  selector: 'app-previous-day-card',
  imports: [TranslatePipe, RouterLink, DayTimeline, ProjectPicker],
  templateUrl: './previous-day-card.html',
  host: { class: 'block rounded-lg border border-line bg-surface p-6' },
})
export class PreviousDayCard {
  /** The day to show (see `previousDayToResolve`). */
  readonly date = input.required<IsoDate>();
  /** Time entries covering at least `date`. */
  readonly entries = input.required<TimeEntry[]>();
  readonly projects = input.required<Project[]>();
  readonly tasks = input.required<Task[]>();
  readonly now = input.required<Date>();

  readonly #entriesService = inject(TimeEntriesService);
  readonly #projectsService = inject(ProjectsService);
  readonly #commits = inject(CommitsService);
  readonly #rules = inject(LiveCatalog).repoRules;
  readonly #toasts = inject(ToastService);
  readonly #locale = inject(LanguageService).locale;

  /** The day's commits and those of the days after it, which may decide its end. */
  readonly #commitDays = liveCommitDays(
    computed(() => ({ from: this.date(), to: addDays(this.date(), COMMIT_LOOKAHEAD_DAYS) }), {
      equal: (a, b) => a.from === b.from,
    }),
  );

  protected readonly start = computed(() => dayStart(this.date()));
  protected readonly isYesterday = computed(() => this.date() === addDays(toIsoDate(this.now()), -1));
  protected readonly title = computed(() => formatDay(this.start(), this.#locale()));
  protected readonly week = computed(() => startOfWeek(this.date()));
  protected readonly periods = computed(() => timelinePeriods(this.entries(), this.date(), this.projects()));
  protected readonly worked = computed(() =>
    formatDuration(
      this.entries()
        .filter(e => e.date === this.date())
        .reduce((ms, e) => ms + entryDurationMs(e, 'work', this.now()), 0),
    ),
  );

  protected readonly rows = computed(() => {
    const day = dayCommits(this.date(), commitDayMap(this.#commitDays.value()), toIsoDate(this.now()));
    return unassignedPeriodsOn(this.entries(), this.date()).map(({ entry, period, end }) => ({
      ref: { entryId: entry.id, periodId: period.id },
      time: `${formatTime(period.start)}–${formatTime(end)}`,
      ms: end.getTime() - period.start.getTime(),
      reason: reasonText(unassignedReason({ start: period.start, end }, day, this.#rules())),
    }));
  });
  protected readonly unassigned = computed(() => formatDuration(this.rows().reduce((ms, r) => ms + r.ms, 0)));
  protected readonly duration = formatDuration;

  protected readonly picking = signal(false);
  protected readonly busy = signal(false);
  /** Translation key of a failed action. */
  protected readonly error = signal<string | null>(null);

  readonly #run = async (action: () => Promise<void>, errorKey: string): Promise<void> => {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
    } catch {
      this.error.set(errorKey);
    } finally {
      this.busy.set(false);
    }
  };

  /** Assigns all of the day's unassigned periods (Undo moves them back). */
  protected readonly assignAll = (result: PickerResult): Promise<void> =>
    this.#run(async () => {
      const refs = this.rows().map(r => r.ref);
      const { target, name } = await pickTarget(result, this.projects(), this.tasks(), n =>
        this.#projectsService.createProject(n, this.projects()),
      );
      const undo = await this.#entriesService.assign(refs, target);
      this.picking.set(false);
      this.#toasts.show({
        message: 'weekView.assignedTo',
        params: { count: refs.length, name },
        actionLabel: 'weekView.undo',
        action: () => undo(),
      });
    }, 'weekView.errors.assign');

  /** Assigns the day's unassigned time from its commits (never overwrites). */
  protected readonly sync = (): Promise<void> =>
    this.#run(async () => this.#toasts.show(syncToast(await this.#commits.assignDay(this.date()), false)), 'weekView.errors.commits');
}
