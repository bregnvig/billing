/**
 * Assigning unassigned time from git commits. Pure functions: Cloud Functions fetch the commits
 * from GitHub (functions/src/github.ts), the web app uses the same logic to explain what's left.
 *
 * A commit says what you were working on *up to* that moment, so it claims the time since the
 * previous commit (the first one claims from the start of the day). Time after the day's last
 * commit goes to that commit's project too. Commits less than `COMMIT_CLUSTER_MS` apart form one
 * group; a group that touches several projects, or a repo without a rule, is inconclusive and its
 * time stays unassigned.
 */
import { Assignment, EntryChanges } from './edit';
import { IsoDate, Period, TimeEntry, timeEntryId } from './entities';

/** One of your commits, by the time it was written (the author date). */
export interface Commit {
  /** `owner/name`, lower case. */
  repo: string;
  sha: string;
  at: Date;
}

/** Commits of one day, as fetched by the functions. Read-only for the owner. */
export interface CommitDay {
  /** The day, also the document id. */
  id: IsoDate;
  commits: Commit[];
  fetchedAt: Date;
}

/** Maps a GitHub repository to a project (and optionally one of its tasks). */
export interface RepoRule {
  id: string;
  /** `owner/name`, lower case (see `normalizeRepo`). */
  repo: string;
  projectId: string;
  taskId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Commits closer together than this are one group. */
export const COMMIT_CLUSTER_MS = 15 * 60_000;

/** `Owner/Name`, a GitHub URL or `owner/name.git` → `owner/name`. `null` when it isn't one. */
export const normalizeRepo = (input: string): string | null => {
  const match = input
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?github\.com\//i, '')
    .replace(/^git@github\.com:/i, '')
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '')
    .match(/^([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)$/);
  return match ? `${match[1]}/${match[2]}`.toLowerCase() : null;
};

/** The assignment a repo's rule gives, or `null` when no rule matches. */
export const ruleFor = (rules: readonly Pick<RepoRule, 'repo' | 'projectId' | 'taskId'>[], repo: string): Assignment | null => {
  const rule = rules.find(r => r.repo === repo.toLowerCase());
  return rule ? { projectId: rule.projectId, taskId: rule.taskId } : null;
};

/** A stretch of the day and what the commits say about it. */
export interface CommitSegment {
  start: Date;
  end: Date;
  /** `null` = inconclusive: several projects, or a repo without a rule. */
  assignment: Assignment | null;
  /** The repos whose commits decided this stretch. */
  repos: string[];
}

const sameAssignment = (a: Assignment | null, b: Assignment | null) => !!a && !!b && a.projectId === b.projectId && a.taskId === b.taskId;
/** Same target, or both inconclusive. */
const sameOutcome = (a: Assignment | null, b: Assignment | null) => (!a && !b) || sameAssignment(a, b);

/**
 * Splits [dayStart, dayEnd) into stretches by commit (see the file comment). No commits that day
 * gives no stretches. Neighbouring stretches with the same outcome are merged.
 */
export const commitSegments = (
  commits: readonly Commit[],
  rules: readonly Pick<RepoRule, 'repo' | 'projectId' | 'taskId'>[],
  dayStart: Date,
  dayEnd: Date,
): CommitSegment[] => {
  const sorted = commits.filter(c => c.at >= dayStart && c.at < dayEnd).sort((a, b) => a.at.getTime() - b.at.getTime());

  const groups: Commit[][] = [];
  for (const commit of sorted) {
    const group = groups.at(-1);
    if (group && commit.at.getTime() - group.at(-1)!.at.getTime() < COMMIT_CLUSTER_MS) group.push(commit);
    else groups.push([commit]);
  }

  const segments: CommitSegment[] = [];
  const push = (segment: CommitSegment) => {
    const previous = segments.at(-1);
    if (segment.end <= segment.start) return;
    if (previous && sameOutcome(previous.assignment, segment.assignment)) {
      previous.end = segment.end;
      previous.repos = [...new Set([...previous.repos, ...segment.repos])];
    } else segments.push(segment);
  };

  let from = dayStart;
  for (const group of groups) {
    const repos = [...new Set(group.map(c => c.repo))];
    const assignments = repos.map(repo => ruleFor(rules, repo));
    const assignment = assignments.every(a => sameAssignment(a, assignments[0])) ? assignments[0] : null;
    const to = group.at(-1)!.at;
    push({ start: from, end: to, assignment, repos });
    from = to;
  }
  const last = segments.at(-1);
  if (last) push({ start: from, end: dayEnd, assignment: last.assignment, repos: [...last.repos] });
  return segments;
};

export interface CommitAssignOutcome extends EntryChanges {
  /** Pieces of unassigned time that got a project. */
  assigned: number;
  /** Pieces left unassigned (inconclusive or no commits). */
  left: number;
}

/**
 * Moves the day's unassigned, finished work periods to the projects the commit segments say,
 * splitting a period where the project changes. The first piece keeps the period's id. Pieces
 * that no conclusive segment covers stay unassigned. Breaks and running periods are left alone.
 */
export const assignByCommits = (
  entries: readonly TimeEntry[],
  date: IsoDate,
  segments: readonly CommitSegment[],
  now: Date,
): CommitAssignOutcome => {
  const byId = new Map(entries.filter(e => e.date === date).map(e => [e.id, structuredClone(e)]));
  const unassignedId = timeEntryId(date, null, null);
  const unassigned = byId.get(unassignedId);
  const outcome: CommitAssignOutcome = { writes: [], deletes: [], assigned: 0, left: 0 };
  if (!unassigned) return outcome;

  const touched = new Set<string>();
  const entryFor = (assignment: Assignment): TimeEntry => {
    const id = timeEntryId(date, assignment.projectId, assignment.taskId);
    let entry = byId.get(id);
    if (!entry) {
      entry = { id, date, ...assignment, periods: [], note: null, createdAt: now, updatedAt: now };
      byId.set(id, entry);
    }
    return entry;
  };

  const kept: Period[] = [];
  for (const period of unassigned.periods) {
    if (period.type !== 'work' || period.end === null) {
      kept.push(period);
      continue;
    }
    const pieces = piecesOf(period, segments);
    if (pieces.every(p => !p.assignment)) {
      kept.push(period);
      outcome.left++;
      continue;
    }
    pieces.forEach((piece, i) => {
      const part: Period = {
        ...period,
        id: i === 0 ? period.id : `${period.id}-${piece.start.getTime()}`,
        start: piece.start,
        end: piece.end,
      };
      if (piece.assignment) {
        const entry = entryFor(piece.assignment);
        entry.periods.push(part);
        touched.add(entry.id);
        outcome.assigned++;
      } else {
        kept.push(part);
        outcome.left++;
      }
    });
    touched.add(unassignedId);
  }

  unassigned.periods = kept;
  for (const id of touched) {
    const entry = byId.get(id)!;
    entry.periods.sort((a, b) => a.start.getTime() - b.start.getTime());
    entry.updatedAt = now;
    if (entry.periods.length) outcome.writes.push(entry);
    else outcome.deletes.push(id);
  }
  return outcome;
};

/** A finished period cut at segment boundaries; neighbouring pieces with the same assignment are joined. */
const piecesOf = (period: Period, segments: readonly CommitSegment[]) => {
  const start = period.start.getTime();
  const end = period.end!.getTime();
  const cuts = [start, end, ...segments.flatMap(s => [s.start.getTime(), s.end.getTime()]).filter(t => t > start && t < end)];
  const points = [...new Set(cuts)].sort((a, b) => a - b);

  const pieces: { start: Date; end: Date; assignment: Assignment | null }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const middle = (points[i] + points[i + 1]) / 2;
    const segment = segments.find(s => s.start.getTime() <= middle && middle < s.end.getTime());
    const assignment = segment?.assignment ?? null;
    const previous = pieces.at(-1);
    if (previous && sameOutcome(previous.assignment, assignment)) {
      previous.end = new Date(points[i + 1]);
    } else pieces.push({ start: new Date(points[i]), end: new Date(points[i + 1]), assignment });
  }
  return pieces;
};

/** Why a stretch of unassigned time wasn't assigned from commits (for the overview). */
export type UnassignedReason =
  /** The day's commits haven't been fetched yet (the nightly run hasn't happened, or failed). */
  | { kind: 'notFetched' }
  /** No commits that day. */
  | { kind: 'noCommits' }
  /** Commits in repos without a rule. */
  | { kind: 'unmapped'; repos: string[] }
  /** Commits for several projects within 15 minutes of each other. */
  | { kind: 'mixed'; repos: string[] }
  /** The commits decide it: it'll be assigned on the next run (e.g. the period was still running). */
  | { kind: 'pending' };

/** Explains a finished unassigned period of a day, from that day's fetched commits (`null` = not fetched). */
export const whyUnassigned = (
  period: { start: Date; end: Date },
  commits: readonly Commit[] | null,
  rules: readonly Pick<RepoRule, 'repo' | 'projectId' | 'taskId'>[],
  dayStart: Date,
  dayEnd: Date,
): UnassignedReason => {
  if (!commits) return { kind: 'notFetched' };
  const overlapping = commitSegments(commits, rules, dayStart, dayEnd).filter(s => s.start < period.end && s.end > period.start);
  if (!overlapping.length) return { kind: 'noCommits' };
  const inconclusive = overlapping.filter(s => !s.assignment);
  if (!inconclusive.length) return { kind: 'pending' };
  const repos = [...new Set(inconclusive.flatMap(s => s.repos))].sort();
  const unmapped = repos.filter(repo => !ruleFor(rules, repo));
  return unmapped.length ? { kind: 'unmapped', repos: unmapped } : { kind: 'mixed', repos };
};
