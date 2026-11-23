import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { addDays, IsoDate, startOfWeek, TimeEntry, toIsoDate } from '@loopme/model';
import { TranslatePipe } from '@ngx-translate/core';
import { commitDayMap, dayCommits, reasonText, unassignedReason } from '../data/commit-insight';
import { CommitsService, syncToast } from '../data/commits.service';
import { liveCommitDays, liveRepoRules } from '../data/live';
import { LanguageService } from '../i18n/language.service';
import { formatDay, formatDuration, formatTime } from '../ui/format';
import { ToastService } from '../ui/toast.service';
import { dayStart } from './dates';

/** How many days back (before today) the card looks for unassigned time. */
export const NEEDS_PROJECT_DAYS = 14;

/**
 * The overview's "Needs a project" card: unassigned work of the last two weeks (today excluded)
 * that the commit matching couldn't decide, with the reason, so you can map a repo or assign by hand.
 * Hidden when there's nothing.
 */
@Component({
  selector: 'app-needs-project-card',
  imports: [TranslatePipe, RouterLink],
  templateUrl: './needs-project-card.html',
  host: { '[class.hidden]': '!days().length' },
})
export class NeedsProjectCard {
  /** Time entries covering at least the last `NEEDS_PROJECT_DAYS` days. */
  readonly entries = input.required<TimeEntry[]>();
  readonly now = input.required<Date>();

  readonly #commits = inject(CommitsService);
  readonly #toasts = inject(ToastService);
  readonly #locale = inject(LanguageService).locale;

  readonly #range = computed(
    () => {
      const today = toIsoDate(this.now());
      return { from: addDays(today, -NEEDS_PROJECT_DAYS), to: addDays(today, -1), today };
    },
    { equal: (a, b) => a.today === b.today },
  );
  /** Up to today: a later day's commits decide the end of an earlier one. */
  readonly #commitDays = liveCommitDays(computed(() => ({ from: this.#range().from, to: this.#range().today })));
  readonly #rules = liveRepoRules();

  protected readonly days = computed(() => {
    const { from, to, today } = this.#range();
    const commitDays = commitDayMap(this.#commitDays.value());
    const rules = this.#rules.value() ?? [];
    const byDay = new Map<IsoDate, { start: Date; end: Date }[]>();
    for (const entry of this.entries()) {
      if (entry.projectId !== null || entry.date < from || entry.date > to) continue;
      const periods = entry.periods.filter(p => p.type === 'work' && p.end).map(p => ({ start: p.start, end: p.end! }));
      if (periods.length) byDay.set(entry.date, [...(byDay.get(entry.date) ?? []), ...periods]);
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, periods]) => {
        const start = dayStart(date);
        const day = dayCommits(date, commitDays, today);
        const rows = periods
          .sort((a, b) => a.start.getTime() - b.start.getTime())
          .map(p => ({
            key: p.start.getTime(),
            time: `${formatTime(p.start)}–${formatTime(p.end)}`,
            duration: formatDuration(p.end.getTime() - p.start.getTime()),
            reason: reasonText(unassignedReason(p, day, rules)),
          }));
        return {
          date,
          title: formatDay(start, this.#locale()),
          total: formatDuration(periods.reduce((sum, p) => sum + p.end.getTime() - p.start.getTime(), 0)),
          rows,
          week: startOfWeek(date),
        };
      });
  });

  /** The day whose commits are being fetched, if any. */
  protected readonly fetching = signal<IsoDate | null>(null);
  /** Translation key of a failed fetch. */
  protected readonly error = signal<string | null>(null);

  protected readonly fetch = async (date: IsoDate): Promise<void> => {
    if (this.fetching()) return;
    this.fetching.set(date);
    this.error.set(null);
    try {
      const result = await this.#commits.assignDay(date);
      this.#toasts.show(syncToast(result, false));
    } catch {
      this.error.set('weekView.errors.commits');
    } finally {
      this.fetching.set(null);
    }
  };
}
