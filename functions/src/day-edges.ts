/**
 * Padding at the edges of a workday. The OS hook notices a workday late at the start (you sit down
 * before the login/unlock is reported) and early at the end (you wrap up after locking), so:
 *
 * - the first hook period of a day starts `DAY_EDGE_PAD_MS` before its start event (`paddedStart`,
 *   used by `applyEvent`), but never before local midnight;
 * - after the day is over, its last period gets `DAY_EDGE_PAD_MS` more at the end (`padDayEnd`, run
 *   nightly by `padDayEnds`), but never past local midnight.
 *
 * Only periods from the hook are padded: manual ones are exactly what was typed in.
 * Pure logic, no Firebase, so it can be unit-tested.
 */
import { addDays, IsoDate, startOfDayIn, TimeEntry } from '@loopme/model';

export const DAY_EDGE_PAD_MS = 5 * 60_000;

/** Where the period for a start event begins: earlier when it's the day's first period. */
export const paddedStart = (entries: readonly TimeEntry[], at: Date, date: IsoDate, tz: string): Date => {
  const firstOfDay = !entries.some(e => e.date === date && e.periods.length > 0);
  if (!firstOfDay) return at;
  return new Date(Math.max(at.getTime() - DAY_EDGE_PAD_MS, startOfDayIn(date, tz).getTime()));
};

export type DayEndResult =
  /** The last period got its padding. */
  | 'padded'
  /** No periods that day. */
  | 'empty'
  /** A period is still running; try again later (it's split at midnight when it stops). */
  | 'running'
  /** The last period is a break, or was entered by hand: left as it is. */
  | 'not-a-hook-period'
  /** The last period already ends at midnight. */
  | 'ends-at-midnight';

export interface DayEndOutcome {
  result: DayEndResult;
  /** Entries to overwrite (whole documents). */
  writes: TimeEntry[];
}

/** Pads the end of the last period on `date` (entries of that day; others are ignored). */
export const padDayEnd = (entries: readonly TimeEntry[], date: IsoDate, tz: string, now: Date): DayEndOutcome => {
  const day = entries.filter(e => e.date === date).map(e => structuredClone(e));
  const periods = day.flatMap(entry => entry.periods.map(period => ({ entry, period })));
  if (!periods.length) return { result: 'empty', writes: [] };
  if (periods.some(({ period }) => period.end === null)) return { result: 'running', writes: [] };

  const last = periods.sort((a, b) => b.period.end!.getTime() - a.period.end!.getTime())[0];
  if (last.period.type !== 'work' || last.period.source !== 'hook') return { result: 'not-a-hook-period', writes: [] };

  const midnight = startOfDayIn(addDays(date, 1), tz);
  const end = new Date(Math.min(last.period.end!.getTime() + DAY_EDGE_PAD_MS, midnight.getTime()));
  if (end <= last.period.end!) return { result: 'ends-at-midnight', writes: [] };

  last.period.end = end;
  last.entry.updatedAt = now;
  return { result: 'padded', writes: [last.entry] };
};
