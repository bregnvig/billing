/**
 * Turns OS hook events (start/stop) into changes to time entries.
 * Pure logic: no Firebase here, so it can be unit-tested. `report-event.ts` loads the
 * entries, calls `applyEvent` inside a transaction and writes the result.
 */
import {
  addDays,
  HookEvent,
  HookEventResult,
  IsoDate,
  isoDateIn,
  Period,
  startOfDayIn,
  TimeEntry,
  timeEntryId,
} from '@loopme/model';

export interface Outcome {
  result: Exclude<HookEventResult, 'duplicate'>;
  /** Entries to create or overwrite (whole documents). */
  writes: TimeEntry[];
}

/** How far back to look for a running period. Older running periods are left alone. */
export const LOOKBACK_DAYS = 7;

const byStart = (a: Period, b: Period) => a.start.getTime() - b.start.getTime();

/**
 * Applies one event to the entries of the last `LOOKBACK_DAYS` days (up to the event's day).
 *
 * - start: opens a running work period in the day's unassigned entry, unless one is already
 *   running today. A running period left over from an earlier day (missed stop, e.g. power
 *   loss) is closed at the end of its own day first, so it stands out for correction.
 * - stop: closes the running period. If it started yesterday (working past midnight), it's
 *   split at local midnight so each day's entry only holds that day's time. If it started
 *   before yesterday it's stale: it's closed at the end of its own day and the stop is ignored,
 *   so a missed stop never fills the days in between with 24-hour periods.
 */
export const applyEvent = (entries: TimeEntry[], event: HookEvent, now: Date): Outcome => {
  const today = isoDateIn(event.at, event.tz);
  const changed = new Map<string, TimeEntry>();
  const all = new Map(entries.map((e) => [e.id, structuredClone(e)]));

  const touch = (entry: TimeEntry) => {
    entry.periods.sort(byStart);
    entry.updatedAt = now;
    changed.set(entry.id, entry);
  };

  const entryFor = (date: IsoDate, projectId: string | null, taskId: string | null): TimeEntry => {
    const id = timeEntryId(date, projectId, taskId);
    let entry = all.get(id);
    if (!entry) {
      entry = {
        id,
        date,
        projectId,
        taskId,
        periods: [],
        note: null,
        createdAt: now,
        updatedAt: now,
      };
      all.set(id, entry);
    }
    return entry;
  };

  const running = [...all.values()]
    .flatMap((entry) =>
      entry.periods.filter((p) => p.end === null).map((period) => ({ entry, period })),
    )
    .sort((a, b) => byStart(b.period, a.period))[0];

  /** Ends `period` at `end`, splitting it at local midnights into following days' entries. */
  const closeAt = (entry: TimeEntry, period: Period, end: Date) => {
    let date = entry.date;
    let current = period;
    let currentEntry = entry;
    let part = 1;
    for (;;) {
      const nextMidnight = startOfDayIn(addDays(date, 1), event.tz);
      if (end <= nextMidnight) {
        current.end = end;
        touch(currentEntry);
        return;
      }
      current.end = nextMidnight;
      touch(currentEntry);
      date = addDays(date, 1);
      currentEntry = entryFor(date, entry.projectId, entry.taskId);
      current = { ...period, id: `${period.id}-${part++}`, start: nextMidnight, end: null };
      currentEntry.periods.push(current);
    }
  };

  if (event.type === 'start') {
    if (running) {
      if (running.entry.date === today) return { result: 'already-running', writes: [] };
      const endOfItsDay = startOfDayIn(addDays(running.entry.date, 1), event.tz);
      running.period.end = endOfItsDay;
      touch(running.entry);
    }
    const unassigned = entryFor(today, null, null);
    unassigned.periods.push({
      id: event.eventId,
      start: event.at,
      end: null,
      type: 'work',
      source: 'hook',
    });
    touch(unassigned);
    return { result: 'started', writes: [...changed.values()] };
  }

  if (!running) return { result: 'no-running-period', writes: [] };
  if (event.at < running.period.start) return { result: 'stop-before-start', writes: [] };
  if (running.entry.date < addDays(today, -1)) {
    running.period.end = startOfDayIn(addDays(running.entry.date, 1), event.tz);
    touch(running.entry);
    return { result: 'closed-stale', writes: [...changed.values()] };
  }
  closeAt(running.entry, running.period, event.at);
  return { result: 'stopped', writes: [...changed.values()] };
};
