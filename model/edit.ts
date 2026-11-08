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
