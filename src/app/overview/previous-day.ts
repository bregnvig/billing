import { IsoDate, TimeEntry } from '@loopme/model';

/** Unassigned time below this doesn't count (same as the unassigned badges). */
const MINUTE = 60_000;

/** Finished unassigned work periods of `date`, oldest first. */
export const unassignedPeriodsOn = (entries: readonly TimeEntry[], date: IsoDate) =>
  entries
    .filter(e => e.date === date && e.projectId === null)
    .flatMap(e => e.periods.filter(p => p.type === 'work' && p.end).map(p => ({ entry: e, period: p, end: p.end! })))
    .sort((a, b) => a.period.start.getTime() - b.period.start.getTime());

/**
 * The previous day you worked, before `today` (usually yesterday; on a Monday, Friday), when it has
 * unassigned time to resolve. `null` when there's none, or nothing to resolve.
 */
export const previousDayToResolve = (entries: readonly TimeEntry[], today: IsoDate): IsoDate | null => {
  const previous = entries
    .filter(e => e.date < today && e.periods.length)
    .map(e => e.date)
    .sort()
    .at(-1);
  if (!previous) return null;
  const unassigned = unassignedPeriodsOn(entries, previous).reduce((ms, p) => ms + p.end.getTime() - p.period.start.getTime(), 0);
  return unassigned >= MINUTE ? previous : null;
};
