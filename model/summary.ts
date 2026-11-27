/**
 * Totals for dashboards. Only `work` periods count; running periods are measured up to `now`.
 * "Unassigned" is work in entries without a project (typically fresh hook periods).
 */
import { daysInMonth, isoWeek, startOfMonth, startOfWeek } from './calendar';
import type { IsoDate, TimeEntry } from './entities';
import { addDays } from './time';

export interface DayTotal {
  work: number;
  unassigned: number;
}

const workPeriods = (entries: readonly TimeEntry[]) =>
  entries.flatMap(entry => entry.periods.filter(p => p.type === 'work').map(period => ({ entry, period })));

/** Worked milliseconds inside the window [from, to), clipping periods that cross its edges. */
export const workMsBetween = (entries: readonly TimeEntry[], from: Date, to: Date, now: Date): number =>
  workPeriods(entries).reduce((sum, { period }) => {
    const start = Math.max(period.start.getTime(), from.getTime());
    const end = Math.min((period.end ?? now).getTime(), to.getTime(), now.getTime());
    return sum + Math.max(0, end - start);
  }, 0);

/** Worked and unassigned milliseconds per day (by the entry's date). */
export const dailyTotals = (entries: readonly TimeEntry[], now: Date): Map<IsoDate, DayTotal> => {
  const totals = new Map<IsoDate, DayTotal>();
  for (const { entry, period } of workPeriods(entries)) {
    const ms = Math.max(0, (period.end ?? now).getTime() - period.start.getTime());
    const day = totals.get(entry.date) ?? { work: 0, unassigned: 0 };
    day.work += ms;
    if (entry.projectId === null) day.unassigned += ms;
    totals.set(entry.date, day);
  }
  return totals;
};

/** The most recently started running period, if any. */
export const runningPeriod = (entries: readonly TimeEntry[]) =>
  workPeriods(entries)
    .filter(({ period }) => period.end === null)
    .sort((a, b) => b.period.start.getTime() - a.period.start.getTime())[0] ?? null;

/** One ISO week of a month, clipped to the month (`from`..`to` inclusive). */
export interface MonthWeek {
  week: number;
  from: IsoDate;
  to: IsoDate;
}

/** A project's worked time in a month. `projectId: null` = unassigned. */
export interface MonthRow {
  projectId: string | null;
  /** Per week, in the order of `MonthSummary.weeks`. */
  weeks: number[];
  total: number;
}

export interface MonthSummary {
  weeks: MonthWeek[];
  /** Projects with time, most time first; unassigned last. */
  rows: MonthRow[];
  /** All projects per week. */
  weekTotals: number[];
  total: number;
}

/**
 * Worked milliseconds per project and ISO week for the month `monthStart` is in, by the entries'
 * dates. A week crossing the month's edge only counts its days inside the month.
 */
export const monthSummary = (entries: readonly TimeEntry[], monthStart: IsoDate, now: Date): MonthSummary => {
  const first = startOfMonth(monthStart);
  const last = addDays(first, daysInMonth(first) - 1);
  const weeks: MonthWeek[] = [];
  for (let from = first; from <= last; from = addDays(startOfWeek(from), 7)) {
    const sunday = addDays(startOfWeek(from), 6);
    weeks.push({ week: isoWeek(from), from, to: sunday < last ? sunday : last });
  }
  const weekOf = (date: IsoDate) => weeks.findIndex(w => date >= w.from && date <= w.to);

  const rows = new Map<string | null, MonthRow>();
  for (const { entry, period } of workPeriods(entries)) {
    const index = weekOf(entry.date);
    if (index < 0) continue;
    const ms = Math.max(0, (period.end ?? now).getTime() - period.start.getTime());
    const row = rows.get(entry.projectId) ?? { projectId: entry.projectId, weeks: weeks.map(() => 0), total: 0 };
    row.weeks[index] += ms;
    row.total += ms;
    rows.set(entry.projectId, row);
  }
  const sorted = [...rows.values()].sort((a, b) => (a.projectId === null ? 1 : b.projectId === null ? -1 : b.total - a.total));
  const weekTotals = weeks.map((_, i) => sorted.reduce((sum, row) => sum + row.weeks[i], 0));
  return { weeks, rows: sorted, weekTotals, total: weekTotals.reduce((sum, ms) => sum + ms, 0) };
};
