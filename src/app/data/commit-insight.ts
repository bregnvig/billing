/**
 * What the commit matching makes of a day, for the UI: the week view's Commits panel and the
 * reasons next to unassigned time (week view and overview). Same logic as the functions
 * (model/commits.ts), from the commits they saved in `commitDays`.
 */
import {
  addDays,
  Assignment,
  Commit,
  CommitDay,
  commitSegments,
  commitWindowEnd,
  datesBetween,
  IsoDate,
  RepoRule,
  ruleFor,
  stillRetried,
  UnassignedReason,
  whyUnassigned,
} from '@loopme/model';
import { dayStart } from '../overview/dates';

type Rule = Pick<RepoRule, 'repo' | 'projectId' | 'taskId'>;

/** A day's commits and the window they're matched in. */
export interface DayCommits {
  /** The day's commits plus those of the days after it, up to its window end. `null` = not fetched yet. */
  commits: Commit[] | null;
  /** Start of the day. */
  from: Date;
  /** End of the day's window (a later day's commit may claim the end of the day). */
  to: Date;
  /** The nightly run still tries the day. */
  retrying: boolean;
}

/** Fetched commit days by date. */
export const commitDayMap = (days: readonly CommitDay[] | null): ReadonlyMap<IsoDate, Commit[]> =>
  new Map((days ?? []).map(d => [d.id, d.commits]));

export const dayCommits = (date: IsoDate, commitDays: ReadonlyMap<IsoDate, readonly Commit[]>, today: IsoDate): DayCommits => ({
  commits: commitDays.has(date) ? datesBetween(date, addDays(commitWindowEnd(date), -1)).flatMap(d => commitDays.get(d) ?? []) : null,
  from: dayStart(date),
  to: dayStart(commitWindowEnd(date)),
  retrying: stillRetried(date, today),
});

/** Why a finished unassigned period wasn't assigned from commits. */
export const unassignedReason = (period: { start: Date; end: Date }, day: DayCommits, rules: readonly Rule[]): UnassignedReason =>
  whyUnassigned(period, day.commits, rules, day.from, day.to, day.retrying);

/** Translation key and params for a reason (`overview.needsProject.reason.*`). */
export const reasonText = (reason: UnassignedReason): { kind: UnassignedReason['kind']; key: string; params: { repos: string } } => ({
  kind: reason.kind,
  key: `overview.needsProject.reason.${reason.kind}`,
  params: { repos: 'repos' in reason ? reason.repos.join(', ') : '' },
});

/** One stretch of a day, as the matching sees it. */
export interface Stretch {
  start: Date;
  end: Date;
  /**
   * `assigned`: the commits decide it. `mixed`: several projects within 15 minutes. `unmapped`: a repo
   * without a project. `waiting` / `manual`: after the last commit so far; a later commit may still
   * claim it, or (after 3 days) it's yours to assign.
   */
  kind: 'assigned' | 'mixed' | 'unmapped' | 'waiting' | 'manual';
  assignment: Assignment | null;
  /** For `unmapped`: the repos without a project. Otherwise the repos that decided it. */
  repos: string[];
  /** The commits that decided it. */
  commits: Commit[];
}

/**
 * The day's stretches: those from `commitSegments` that overlap the day, then, once the day is
 * over, the time after the last commit that no commit claims yet. Empty when not fetched.
 */
export const dayStretches = (date: IsoDate, day: DayCommits, rules: readonly Rule[], now: Date): Stretch[] => {
  if (!day.commits) return [];
  const dayEnd = dayStart(addDays(date, 1));
  const segments = commitSegments(day.commits, rules, day.from, day.to);
  const stretches: Stretch[] = segments
    .filter(s => s.start < dayEnd)
    .map((s, i) => {
      const commits = day.commits!.filter(c => (i === 0 ? c.at >= s.start : c.at > s.start) && c.at <= s.end);
      const unmapped = s.repos.filter(repo => !ruleFor(rules, repo));
      const kind = s.assignment ? 'assigned' : unmapped.length ? 'unmapped' : 'mixed';
      return { start: s.start, end: s.end, kind, assignment: s.assignment, repos: kind === 'unmapped' ? unmapped : s.repos, commits };
    });
  const covered = segments.at(-1)?.end ?? day.from;
  if (covered < dayEnd && dayEnd <= now) {
    stretches.push({ start: covered, end: dayEnd, kind: day.retrying ? 'waiting' : 'manual', assignment: null, repos: [], commits: [] });
  }
  return stretches;
};
