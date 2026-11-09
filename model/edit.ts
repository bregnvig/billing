/**
 * Editing time entries. Pure functions: the caller loads the entries (in a transaction),
 * applies these and writes the result.
 */
import { Period, TimeEntry, timeEntryId } from './entities';

/** A period, identified by the entry it's in. */
export interface PeriodRef {
  entryId: string;
  periodId: string;
}

/** Where periods are assigned to. `projectId: null` = unassigned (then `taskId` is null too). */
export interface Assignment {
  projectId: string | null;
  taskId: string | null;
}

export interface EntryChanges {
  /** Entries to create or overwrite (whole documents). */
  writes: TimeEntry[];
  /** Entry ids to delete (left without periods). */
  deletes: string[];
}

const byStart = (a: { start: Date }, b: { start: Date }) => a.start.getTime() - b.start.getTime();

/** The entry ids a move touches, so they can be read first: sources plus their targets. */
export const entryIdsForMove = (refs: readonly PeriodRef[], target: Assignment): string[] => {
  const ids = new Set<string>();
  for (const { entryId } of refs) {
    ids.add(entryId);
    ids.add(timeEntryId(entryId.slice(0, 10) as TimeEntry['date'], target.projectId, target.taskId));
  }
  return [...ids];
};

/**
 * Moves periods to the entry for `target` on the same day. Each period keeps its id, times,
 * type and source. Source entries left empty are deleted; target entries are created as needed.
 * Periods already in the target entry, or not found, are skipped.
 */
export const movePeriods = (entries: readonly TimeEntry[], refs: readonly PeriodRef[], target: Assignment, now: Date): EntryChanges => {
  const assignment: Assignment = target.projectId === null ? { projectId: null, taskId: null } : target;
  const byId = new Map(entries.map(e => [e.id, structuredClone(e)]));
  const touched = new Set<string>();

  for (const { entryId, periodId } of refs) {
    const source = byId.get(entryId);
    const index = source?.periods.findIndex(p => p.id === periodId) ?? -1;
    if (!source || index < 0) continue;

    const targetId = timeEntryId(source.date, assignment.projectId, assignment.taskId);
    if (targetId === source.id) continue;

    let destination = byId.get(targetId);
    if (!destination) {
      destination = { id: targetId, date: source.date, ...assignment, periods: [], note: null, createdAt: now, updatedAt: now };
      byId.set(targetId, destination);
    }

    const [period] = source.periods.splice(index, 1);
    destination.periods.push(period);
    destination.periods.sort(byStart);
    source.updatedAt = now;
    destination.updatedAt = now;
    touched.add(source.id).add(destination.id);
  }

  const writes: TimeEntry[] = [];
  const deletes: string[] = [];
  for (const id of touched) {
    const entry = byId.get(id)!;
    if (entry.periods.length) writes.push(entry);
    else if (entries.some(e => e.id === id)) deletes.push(id);
  }
  return { writes, deletes };
};

/** Adds a period to the entry for `assignment` on `date`, creating the entry if needed. */
export const addPeriod = (
  existing: TimeEntry | null,
  date: TimeEntry['date'],
  assignment: Assignment,
  period: Period,
  now: Date,
): TimeEntry => {
  const target: Assignment = assignment.projectId === null ? { projectId: null, taskId: null } : assignment;
  const entry: TimeEntry = existing
    ? structuredClone(existing)
    : { id: timeEntryId(date, target.projectId, target.taskId), date, ...target, periods: [], note: null, createdAt: now, updatedAt: now };
  entry.periods.push(period);
  entry.periods.sort(byStart);
  entry.updatedAt = now;
  return entry;
};

/** Removes a period. Returns the entry to write, or `null` when it's left empty (delete it). */
export const removePeriod = (entry: TimeEntry, periodId: string, now: Date): TimeEntry | null => {
  const periods = entry.periods.filter(p => p.id !== periodId);
  return periods.length ? { ...structuredClone(entry), periods, updatedAt: now } : null;
};

/** Periods that overlap [start, end). Running periods are treated as lasting until `now`. */
export const overlapping = <T extends Pick<Period, 'start' | 'end'>>(periods: readonly T[], start: Date, end: Date, now: Date): T[] =>
  periods.filter(p => p.start < end && (p.end ?? now) > start);

/** Changes a period's type (work ↔ break). Returns the updated entry, or null if not found. */
export const setPeriodType = (entry: TimeEntry, periodId: string, type: Period['type'], now: Date): TimeEntry | null => {
  if (!entry.periods.some(p => p.id === periodId)) return null;
  return { ...structuredClone(entry), periods: entry.periods.map(p => (p.id === periodId ? { ...p, type } : p)), updatedAt: now };
};

/**
 * Sets a period's end: a time to stop it, or `null` to make it running again (undo of a stop).
 * The end is never before the start. Returns the updated entry, or null if the period isn't found.
 */
export const setPeriodEnd = (entry: TimeEntry, periodId: string, end: Date | null, now: Date): TimeEntry | null => {
  const period = entry.periods.find(p => p.id === periodId);
  if (!period) return null;
  const clamped = end && end < period.start ? period.start : end;
  return { ...structuredClone(entry), periods: entry.periods.map(p => (p.id === periodId ? { ...p, end: clamped } : p)), updatedAt: now };
};

/** How many days back a new period looks for the work it continues (see `continuingAssignment`). */
export const CARRY_OVER_DAYS = 7;

/**
 * Where a newly started period goes: the project + task of the most recently started work period
 * up to `at` (breaks skipped), since you're most likely continuing that work. Unassigned when
 * there's none. Pass only the entries of the last `CARRY_OVER_DAYS` days. Shared by the OS hook's
 * start and the manual Start on the overview.
 */
export const continuingAssignment = (entries: readonly TimeEntry[], at: Date): Assignment => {
  const previous = entries
    .flatMap(entry => entry.periods.filter(p => p.type === 'work' && p.start <= at).map(period => ({ entry, period })))
    .sort((a, b) => b.period.start.getTime() - a.period.start.getTime())[0]?.entry;
  return previous?.projectId ? { projectId: previous.projectId, taskId: previous.taskId } : { projectId: null, taskId: null };
};

export interface Gap {
  start: Date;
  end: Date;
}

/**
 * Unrecorded time between a day's periods (e.g. the screen was locked over lunch), at least
 * `minMs` long. Only gaps *between* periods count: not before the first or after the last.
 * Overlapping periods are merged first; running periods last until `now`.
 */
export const gapsBetween = (periods: readonly Pick<Period, 'start' | 'end'>[], now: Date, minMs = 60_000): Gap[] => {
  const spans = periods.map(p => ({ start: p.start.getTime(), end: (p.end ?? now).getTime() })).sort((a, b) => a.start - b.start);
  const gaps: Gap[] = [];
  let reach = spans[0]?.end ?? 0;
  for (const span of spans.slice(1)) {
    if (span.start - reach >= minMs) gaps.push({ start: new Date(reach), end: new Date(span.start) });
    reach = Math.max(reach, span.end);
  }
  return gaps;
};
