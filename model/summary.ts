/**
 * Totals for dashboards. Only `work` periods count; running periods are measured up to `now`.
 * "Unassigned" is work in entries without a project (typically fresh hook periods).
 */
import type { IsoDate, TimeEntry } from './entities';

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
