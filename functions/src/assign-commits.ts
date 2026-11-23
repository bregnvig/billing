import { FieldValue, Firestore, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import {
  addDays,
  assignByCommits,
  Commit,
  COMMIT_LOOKAHEAD_DAYS,
  commitSegments,
  commitWindowEnd,
  COLLECTIONS,
  datesBetween,
  IsoDate,
  isoDateIn,
  isValidTimeZone,
  RepoRule,
  startOfDayIn,
} from '@loopme/model';
import { entryFromDoc, entryToDoc } from './firestore';
import { fetchCommits } from './github';
import { functionOptions } from './options';
import { assertOwner } from './owner';
import { DEFAULT_TIME_ZONE, latestTimeZone } from './time-zone';

/** Classic GitHub personal access token with `repo` scope. `firebase functions:secrets:set GITHUB_TOKEN`. */
const githubToken = defineSecret('GITHUB_TOKEN');

export interface AssignResult {
  commits: number;
  assigned: number;
  left: number;
  /** Repos whose commits couldn't be read (deleted branch, no access). */
  failedRepos: string[];
}

type Rule = Pick<RepoRule, 'repo' | 'projectId' | 'taskId'>;

const loadRules = async (db: Firestore): Promise<Rule[]> =>
  (await db.collection(COLLECTIONS.repoRules).get()).docs.map(d => ({
    repo: d.get('repo') as string,
    projectId: d.get('projectId') as string,
    taskId: (d.get('taskId') as string | null) ?? null,
  }));

/**
 * Assigns `date`'s unassigned time by the commits from the start of that day to the end of its
 * window (`commitWindowEnd`) or `now`, whichever is first: a later day's first commit claims the
 * time after the day's last commit (model/commits.ts). Returns what it did.
 */
const assignDay = async (
  db: Firestore,
  date: IsoDate,
  tz: string,
  commits: readonly Commit[],
  rules: readonly Rule[],
  now: Date,
  overwrite: boolean,
) => {
  const from = startOfDayIn(date, tz);
  const to = new Date(Math.min(now.getTime(), startOfDayIn(commitWindowEnd(date), tz).getTime()));
  const segments = commitSegments(commits, rules, from, to);
  const outcome = await db.runTransaction(async tx => {
    const snapshot = await tx.get(db.collection(COLLECTIONS.timeEntries).where('date', '==', date));
    const result = assignByCommits(
      snapshot.docs.map(d => entryFromDoc(d.id, d.data())),
      date,
      segments,
      new Date(),
      overwrite,
    );
    for (const entry of result.writes) tx.set(db.collection(COLLECTIONS.timeEntries).doc(entry.id), entryToDoc(entry));
    for (const id of result.deletes) tx.delete(db.collection(COLLECTIONS.timeEntries).doc(id));
    return result;
  });
  logger.info('assigned from commits', { date, tz, assigned: outcome.assigned, left: outcome.left });
  return outcome;
};

/**
 * Saves each finished day's commits in `commitDays/{date}`, so the web app can explain what's left
 * unassigned. A day still going on isn't saved: its commits aren't complete.
 */
const saveCommitDays = async (db: Firestore, days: readonly IsoDate[], tz: string, commits: readonly Commit[], now: Date) => {
  const batch = db.batch();
  for (const date of days) {
    const [start, end] = [startOfDayIn(date, tz), startOfDayIn(addDays(date, 1), tz)];
    if (end > now) continue;
    batch.set(db.collection(COLLECTIONS.commitDays).doc(date), {
      commits: commits.filter(c => c.at >= start && c.at < end).map(c => ({ repo: c.repo, sha: c.sha, at: Timestamp.fromDate(c.at) })),
      fetchedAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
};

/**
 * Fetches the commits from the start of `first` up to the end of `last`'s window (or now), saves
 * them per day and assigns each of the days `first`..`last` by them. `overwrite` redoes what was
 * assigned from commits before (never what you assigned yourself); the nightly run never does.
 */
const assignDays = async (
  db: Firestore,
  token: string,
  first: IsoDate,
  last: IsoDate,
  tz: string,
  overwrite = false,
): Promise<AssignResult> => {
  const now = new Date();
  const from = startOfDayIn(first, tz);
  const to = new Date(Math.min(now.getTime(), startOfDayIn(commitWindowEnd(last), tz).getTime()));
  const { commits, failedRepos } = await fetchCommits(token, from, to);
  const rules = await loadRules(db);
  await saveCommitDays(db, datesBetween(first, addDays(commitWindowEnd(last), -1)), tz, commits, now);

  const result: AssignResult = { commits: 0, assigned: 0, left: 0, failedRepos };
  for (const date of datesBetween(first, last)) {
    const outcome = await assignDay(db, date, tz, commits, rules, now, overwrite);
    result.assigned += outcome.assigned;
    result.left += outcome.left;
  }
  const [dayStart, dayEnd] = [startOfDayIn(first, tz), startOfDayIn(addDays(last, 1), tz)];
  result.commits = commits.filter(c => c.at >= dayStart && c.at < dayEnd).length;
  return result;
};

/**
 * Nightly, after `padDayEnds` (00:05): assigns the unassigned time of the last
 * `COMMIT_LOOKAHEAD_DAYS + 1` days. A day is tried again each night until it has seen the commits
 * of the `COMMIT_LOOKAHEAD_DAYS` days after it (so Friday's afternoon can wait for Monday's first
 * commit); what's still unassigned after that is left to you.
 */
export const assignFromCommitsNightly = onSchedule(
  { ...functionOptions, schedule: '30 0 * * *', timeZone: DEFAULT_TIME_ZONE, secrets: [githubToken] },
  async () => {
    const db = getFirestore();
    const tz = await latestTimeZone(db);
    const today = isoDateIn(new Date(), tz);
    const result = await assignDays(db, githubToken.value(), addDays(today, -(COMMIT_LOOKAHEAD_DAYS + 1)), addDays(today, -1), tz);
    logger.info('nightly commit assignment', { today, ...result });
  },
);

/**
 * The same for one day, on demand ("Fetch from commits" in the week view and on the overview).
 * `{ date, tz, overwrite? }`. Owner only.
 */
export const assignFromCommits = onCall({ ...functionOptions, secrets: [githubToken] }, async request => {
  assertOwner(request);
  const { date, tz, overwrite } = request.data ?? {};
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpsError('invalid-argument', 'date must be YYYY-MM-DD.');
  if (typeof tz !== 'string' || !isValidTimeZone(tz)) throw new HttpsError('invalid-argument', 'tz must be an IANA time zone.');
  try {
    return await assignDays(getFirestore(), githubToken.value(), date as IsoDate, date as IsoDate, tz, overwrite === true);
  } catch (error) {
    logger.error('assign from commits failed', { date, error: String(error) });
    throw new HttpsError('unavailable', 'Could not read the commits from GitHub.');
  }
});
