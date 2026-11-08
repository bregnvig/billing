import { Component, computed, inject, signal } from '@angular/core';
import {
  addDays,
  dailyTotals,
  datesBetween,
  daysInMonth,
  IsoDate,
  isoWeek,
  Project,
  ProjectColor,
  runningPeriod,
  startOfMonth,
  startOfPreviousMonth,
  startOfWeek,
  TimeEntry,
  toIsoDate,
  weekdayIndex,
  workMsBetween,
} from '@loopme/model';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../auth/auth.service';
import { liveEntries, liveProjects } from '../data/live';
import { LanguageService } from '../i18n/language.service';
import { injectNow } from '../ui/clock';
import {
  formatChange,
  formatDay,
  formatDuration,
  formatLongDate,
  formatMonth,
  formatRange,
  formatTime,
  formatWeekday,
  formatWeekdayShort,
} from '../ui/format';
import { LineChart } from '../ui/line-chart';
import { PROJECT_COLORS } from '../ui/marker';
import { MetricCard } from '../ui/metric-card';
import { DayTimeline, TimelinePeriod } from './day-timeline';
import { WeekBarDay, WeekBars } from './week-bars';

/** Local midnight of an IsoDate. */
const dayStart = (date: IsoDate): Date => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Same wall-clock time `days` days earlier/later (DST-safe). */
const shiftDays = (t: Date, days: number): Date =>
  new Date(t.getFullYear(), t.getMonth(), t.getDate() + days, t.getHours(), t.getMinutes(), t.getSeconds());

/** Translation key for the greeting at a given hour. */
const greetingKeyFor = (hour: number): string =>
  `overview.greeting.${hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'afternoon' : 'evening'}`;

/** Landing page: today, this week and this month at a glance. */
@Component({
  selector: 'app-overview-page',
  imports: [MetricCard, DayTimeline, WeekBars, LineChart, TranslatePipe],
  templateUrl: './overview.page.html',
  styleUrl: './overview.page.scss',
})
export class OverviewPage {
  readonly #auth = inject(AuthService);
  readonly #locale = inject(LanguageService).locale;
  protected readonly now = injectNow();
  protected readonly today = computed(() => toIsoDate(this.now()));

  readonly #range = computed(() => ({ from: startOfPreviousMonth(this.today()), to: this.today() }), {
    equal: (a, b) => a.from === b.from && a.to === b.to,
  });
  readonly #entries = liveEntries(this.#range);
  readonly #projects = liveProjects();

  protected readonly error = computed(() => this.#entries.error() ?? this.#projects.error());
  protected readonly loaded = computed(() => this.#entries.value() !== null);
  /** Skeletons only after 200ms, so fast loads don't flash (ui-design states). */
  protected readonly showSkeleton = signal(false);

  constructor() {
    setTimeout(() => this.showSkeleton.set(true), 200);
  }

  readonly #list = computed(() => this.#entries.value() ?? []);
  readonly #totals = computed(() => dailyTotals(this.#list(), this.now()));

  // --- Greeting -------------------------------------------------------------------------

  protected readonly greetingKey = computed(() => greetingKeyFor(this.now().getHours()));
  protected readonly firstName = computed(() => this.#auth.user()?.displayName?.split(' ')[0] ?? null);
  protected readonly sublineParams = computed(() => ({
    date: formatLongDate(this.now(), this.#locale()),
    week: isoWeek(this.today()),
  }));

  // --- Today ----------------------------------------------------------------------------

  readonly #colorOf = computed(() => {
    const projects: Project[] = this.#projects.value() ?? [];
    return new Map<string, { color: ProjectColor; name: string }>(
      projects.map((p, i) => [p.id, { color: p.color ?? PROJECT_COLORS[i % PROJECT_COLORS.length], name: p.name }]),
    );
  });

  protected readonly todayStart = computed(() => dayStart(this.today()));
  protected readonly todayLabel = computed(() => formatDay(this.now(), this.#locale()));
  protected readonly todayWork = computed(() => workMsBetween(this.#list(), this.todayStart(), this.now(), this.now()));
  protected readonly todayLastWeek = computed(() =>
    workMsBetween(this.#list(), shiftDays(this.todayStart(), -7), shiftDays(this.now(), -7), this.now()),
  );
  protected readonly todayUnassigned = computed(() => this.#totals().get(this.today())?.unassigned ?? 0);

  protected readonly todayPeriods = computed((): TimelinePeriod[] => {
    const colors = this.#colorOf();
    return this.#list()
      .filter((e: TimeEntry) => e.date === this.today())
      .flatMap(e => {
        const project = e.projectId ? colors.get(e.projectId) : undefined;
        return e.periods.map(p => ({
          id: p.id,
          start: p.start,
          end: p.end,
          type: p.type,
          color: project?.color ?? null,
          label: project?.name ?? null,
          labelKey: project ? null : e.projectId ? 'timeline.unknownProject' : 'timeline.unassigned',
        }));
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  });

  protected readonly running = computed(() => {
    const r = runningPeriod(this.#list());
    return r ? { since: formatTime(r.period.start) } : null;
  });

  // --- This week ------------------------------------------------------------------------

  readonly #weekStart = computed(() => startOfWeek(this.today()));
  protected readonly weekWork = computed(() => workMsBetween(this.#list(), dayStart(this.#weekStart()), this.now(), this.now()));
  protected readonly weekLastWeek = computed(() =>
    workMsBetween(this.#list(), dayStart(addDays(this.#weekStart(), -7)), shiftDays(this.now(), -7), this.now()),
  );
  protected readonly weekSubtitleParams = computed(() => ({
    week: isoWeek(this.today()),
    range: formatRange(dayStart(this.#weekStart()), dayStart(addDays(this.#weekStart(), 6)), this.#locale()),
  }));

  /** Mon-Fri always; Sat/Sun only when they have time or are today. */
  protected readonly weekDays = computed((): WeekBarDay[] => {
    const totals = this.#totals();
    return datesBetween(this.#weekStart(), addDays(this.#weekStart(), 6))
      .map(date => ({ date, d: dayStart(date) }))
      .filter(({ date }) => weekdayIndex(date) < 5 || (totals.get(date)?.work ?? 0) > 0 || date === this.today())
      .map(({ date, d }) => ({
        short: formatWeekdayShort(d, this.#locale()),
        long: formatLongDate(d, this.#locale()),
        work: totals.get(date)?.work ?? 0,
        lastWeek: totals.get(addDays(date, -7))?.work ?? 0,
        isToday: date === this.today(),
        isFuture: date > this.today(),
      }));
  });

  // --- This month -----------------------------------------------------------------------

  readonly #monthStart = computed(() => startOfMonth(this.today()));
  readonly #prevMonthStart = computed(() => startOfPreviousMonth(this.today()));
  protected readonly monthName = computed(() => formatMonth(this.now(), this.#locale()));
  protected readonly prevMonthName = computed(() => formatMonth(dayStart(this.#prevMonthStart()), this.#locale()));

  protected readonly monthWork = computed(() => workMsBetween(this.#list(), dayStart(this.#monthStart()), this.now(), this.now()));
  /** Last month up to the same day and time (clamped to its last day). */
  protected readonly monthLastMonth = computed(() => {
    const prev = dayStart(this.#prevMonthStart());
    const day = Math.min(this.now().getDate(), daysInMonth(this.#prevMonthStart()));
    const samePoint = new Date(prev.getFullYear(), prev.getMonth(), day, this.now().getHours(), this.now().getMinutes());
    return workMsBetween(this.#list(), prev, samePoint, this.now());
  });

  readonly #cumulative = (from: IsoDate, to: IsoDate): number[] => {
    const totals = this.#totals();
    let sum = 0;
    return datesBetween(from, to).map(date => (sum += totals.get(date)?.work ?? 0));
  };
  protected readonly monthSeries = computed(() => this.#cumulative(this.#monthStart(), this.today()));
  protected readonly prevMonthSeries = computed(() => this.#cumulative(this.#prevMonthStart(), addDays(this.#monthStart(), -1)));
  protected readonly monthLength = computed(() => Math.max(daysInMonth(this.#monthStart()), daysInMonth(this.#prevMonthStart())));
  protected readonly workdays = computed(
    () => datesBetween(this.#monthStart(), this.today()).filter(d => (this.#totals().get(d)?.work ?? 0) > 0).length,
  );

  // --- Formatting for the template ---------------------------------------------------------

  protected readonly duration = formatDuration;
  protected readonly change = formatChange;
  protected readonly weekday = computed(() => formatWeekday(this.now(), this.#locale()));
  protected readonly monthSummaryParams = computed(() => ({
    worked: formatDuration(this.monthWork()),
    month: this.monthName(),
    previous: formatDuration(this.monthLastMonth()),
    previousMonth: this.prevMonthName(),
  }));
}
