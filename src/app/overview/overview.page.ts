import { Component, computed, inject, signal } from '@angular/core';
import {
  addDays,
  dailyTotals,
  datesBetween,
  daysInMonth,
  IsoDate,
  isoWeek,
  startOfMonth,
  startOfPreviousMonth,
  startOfWeek,
  toIsoDate,
  weekdayIndex,
  workMsBetween,
} from '@loopme/model';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../auth/auth.service';
import { liveEntries, liveProjects, liveTasks } from '../data/live';
import { LanguageService } from '../i18n/language.service';
import { injectNow } from '../ui/clock';
import { formatChange, formatDuration, formatLongDate, formatMonth, formatRange, formatWeekdayShort } from '../ui/format';
import { LineChart } from '../ui/line-chart';
import { MetricCard } from '../ui/metric-card';
import { dayStart, shiftDays } from './dates';
import { TodayCard } from './today-card';
import { WeekBarDay, WeekBars } from './week-bars';

/** Translation key for the greeting at a given hour. */
const greetingKeyFor = (hour: number): string =>
  `overview.greeting.${hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'afternoon' : 'evening'}`;

/** Landing page: today, this week and this month at a glance. */
@Component({
  selector: 'app-overview-page',
  imports: [MetricCard, TodayCard, WeekBars, LineChart, TranslatePipe],
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
  readonly #tasks = liveTasks();

  protected readonly error = computed(() => this.#entries.error() ?? this.#projects.error());
  protected readonly loaded = computed(() => this.#entries.value() !== null);
  /** Skeletons only after 200ms, so fast loads don't flash (ui-design states). */
  protected readonly showSkeleton = signal(false);

  constructor() {
    setTimeout(() => this.showSkeleton.set(true), 200);
  }

  protected readonly list = computed(() => this.#entries.value() ?? []);
  protected readonly projectList = computed(() => this.#projects.value() ?? []);
  protected readonly taskList = computed(() => this.#tasks.value() ?? []);
  readonly #totals = computed(() => dailyTotals(this.list(), this.now()));

  // --- Greeting -------------------------------------------------------------------------

  protected readonly greetingKey = computed(() => greetingKeyFor(this.now().getHours()));
  protected readonly firstName = computed(() => this.#auth.user()?.displayName?.split(' ')[0] ?? null);
  protected readonly sublineParams = computed(() => ({
    date: formatLongDate(this.now(), this.#locale()),
    week: isoWeek(this.today()),
  }));

  // --- This week ------------------------------------------------------------------------

  readonly #weekStart = computed(() => startOfWeek(this.today()));
  protected readonly weekWork = computed(() => workMsBetween(this.list(), dayStart(this.#weekStart()), this.now(), this.now()));
  protected readonly weekLastWeek = computed(() =>
    workMsBetween(this.list(), dayStart(addDays(this.#weekStart(), -7)), shiftDays(this.now(), -7), this.now()),
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

  protected readonly monthWork = computed(() => workMsBetween(this.list(), dayStart(this.#monthStart()), this.now(), this.now()));
  /** Last month up to the same day and time (clamped to its last day). */
  protected readonly monthLastMonth = computed(() => {
    const prev = dayStart(this.#prevMonthStart());
    const day = Math.min(this.now().getDate(), daysInMonth(this.#prevMonthStart()));
    const samePoint = new Date(prev.getFullYear(), prev.getMonth(), day, this.now().getHours(), this.now().getMinutes());
    return workMsBetween(this.list(), prev, samePoint, this.now());
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
  protected readonly monthSummaryParams = computed(() => ({
    worked: formatDuration(this.monthWork()),
    month: this.monthName(),
    previous: formatDuration(this.monthLastMonth()),
    previousMonth: this.prevMonthName(),
  }));
}
