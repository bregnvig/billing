/**
 * Domain model for the working-hours tracker.
 *
 * Firestore layout (all top-level collections):
 *   projects/{projectId}
 *   tasks/{taskId}            -> belongs to a project via `projectId`
 *   timeEntries/{entryId}     -> one per (date, project, task); id from `timeEntryId()`
 *
 * Dates are `Date` in the app and Firestore `Timestamp` in the database;
 * see `converters.ts` for the mapping.
 */

/**
 * Palette key for a project's color. The actual light/dark values and the marker shape
 * live in the UI (see the `ui-design` skill), so stored data doesn't depend on the theme.
 */
export type ProjectColor =
  'blue' | 'orange' | 'pink' | 'brown' | 'green' | 'purple' | 'yellow' | 'red';

/** Something hours can be booked against. */
export interface Project {
  id: string;
  name: string;
  /** Optional palette color; `null` lets the UI pick one by position. */
  color: ProjectColor | null;
  /** Archived projects are hidden from pickers but keep their history. */
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Optional subdivision of a project. */
export interface Task {
  id: string;
  projectId: string;
  name: string;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Where a period came from. */
export type PeriodSource = 'hook' | 'manual';

/** Breaks are recorded but don't count toward worked hours. */
export type PeriodType = 'work' | 'break';

/** Local calendar day as `YYYY-MM-DD` (e.g. `2026-11-05`). */
export type IsoDate = `${string}-${string}-${string}`;

/** One continuous stretch of work (or break) between a start and a stop. */
export interface Period {
  /** Stable id within the entry, so the UI can edit/move a single period. */
  id: string;
  start: Date;
  /** `null` while the period is still running (hook reported start, no stop yet). */
  end: Date | null;
  type: PeriodType;
  source: PeriodSource;
}

/**
 * All work on one day for one project/task combination.
 * A day can have several periods (e.g. before and after lunch) for the same project/task.
 */
export interface TimeEntry {
  /** Deterministic: see `timeEntryId()`. */
  id: string;
  date: IsoDate;
  /**
   * `null` means "not yet assigned": OS hooks only know that work started/stopped,
   * so their periods land in the day's unassigned entry and are moved in the UI.
   */
  projectId: string | null;
  /** Optional; must belong to `projectId` when set. Always `null` when `projectId` is `null`. */
  taskId: string | null;
  /** Sorted by `start`. */
  periods: Period[];
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Fields the caller supplies when creating a document; id and audit fields are set by the data layer. */
export type NewProject = Pick<Project, 'name'> & Partial<Pick<Project, 'color'>>;
export type NewTask = Pick<Task, 'projectId' | 'name'>;

/** Document id for the entry of a given day/project/task, e.g. `2026-11-05_acme_api` or `2026-11-05__`. */
export const timeEntryId = (
  date: IsoDate,
  projectId: string | null,
  taskId: string | null,
): string => `${date}_${projectId ?? ''}_${taskId ?? ''}`;

/** Local `YYYY-MM-DD` for a Date (not UTC, so late-evening work stays on the right day). */
export const toIsoDate = (d: Date): IsoDate => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Duration of a period in milliseconds. Running periods are measured up to `now`. */
export const periodDurationMs = (period: Pick<Period, 'start' | 'end'>, now = new Date()): number =>
  Math.max(0, (period.end ?? now).getTime() - period.start.getTime());

/** Total duration of an entry's periods of the given type, in milliseconds. */
export const entryDurationMs = (
  entry: Pick<TimeEntry, 'periods'>,
  type: PeriodType = 'work',
  now = new Date(),
): number =>
  entry.periods
    .filter((p) => p.type === type)
    .reduce((sum, p) => sum + periodDurationMs(p, now), 0);
