import { FieldValue, Firestore, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { addDays, assignByCommits, commitSegments, COLLECTIONS, IsoDate, isoDateIn, isValidTimeZone, startOfDayIn } from '@loopme/model';
import { entryFromDoc, entryToDoc } from './firestore';
import { fetchCommits } from './github';
import { functionOptions } from './options';
import { assertOwner } from './owner';
import { DEFAULT_TIME_ZONE, latestTimeZone } from './time-zone';

/** Classic GitHub personal access token with `repo` scope. `firebase functions:secrets:set GITHUB_TOKEN`. */
const githubToken = defineSecret('GITHUB_TOKEN');

export interface AssignDayResult {
  commits: number;
  assigned: number;
  left: number;
  /** Repos whose commits couldn't be read (deleted branch, no access). */
  failedRepos: string[];
}

/**
 * Fetches the day's commits, saves them to `commitDays/{date}` (the web app explains what's left
 * unassigned from them) and assigns the day's unassigned time by them (model/commits.ts).
 */
const assignDay = async (db: Firestore, token: string, date: IsoDate, tz: string): Promise<AssignDayResult> => {
  const dayStart = startOfDayIn(date, tz);
  const dayEnd = startOfDayIn(addDays(date, 1), tz);
  const { commits, failedRepos } = await fetchCommits(token, dayStart, dayEnd);
  const rules = (await db.collection(COLLECTIONS.repoRules).get()).docs.map(d => ({
    repo: d.get('repo') as string,
    projectId: d.get('projectId') as string,
    taskId: (d.get('taskId') as string | null) ?? null,
  }));
  const segments = commitSegments(commits, rules, dayStart, dayEnd);

  const outcome = await db.runTransaction(async tx => {
    const snapshot = await tx.get(db.collection(COLLECTIONS.timeEntries).where('date', '==', date));
    const result = assignByCommits(
      snapshot.docs.map(d => entryFromDoc(d.id, d.data())),
      date,
      segments,
      new Date(),
    );
    for (const entry of result.writes) tx.set(db.collection(COLLECTIONS.timeEntries).doc(entry.id), entryToDoc(entry));
    for (const id of result.deletes) tx.delete(db.collection(COLLECTIONS.timeEntries).doc(id));
    tx.set(db.collection(COLLECTIONS.commitDays).doc(date), {
      commits: commits.map(c => ({ repo: c.repo, sha: c.sha, at: Timestamp.fromDate(c.at) })),
      fetchedAt: FieldValue.serverTimestamp(),
    });
    return result;
  });

  const result = { commits: commits.length, assigned: outcome.assigned, left: outcome.left, failedRepos };
  logger.info('assigned from commits', { date, tz, ...result });
  return result;
};

/**
 * Nightly, after `padDayEnds` (00:05): assigns yesterday's unassigned time from its commits, and
 * the day before again, for commits that were pushed late.
 */
export const assignFromCommitsNightly = onSchedule(
  { ...functionOptions, schedule: '30 0 * * *', timeZone: DEFAULT_TIME_ZONE, secrets: [githubToken] },
  async () => {
    const db = getFirestore();
    const tz = await latestTimeZone(db);
    const today = isoDateIn(new Date(), tz);
    for (const date of [addDays(today, -2), addDays(today, -1)]) await assignDay(db, githubToken.value(), date, tz);
  },
);

/** The same for one day, on demand (the week view's "Fetch from commits"). Owner only. */
export const assignFromCommits = onCall({ ...functionOptions, secrets: [githubToken] }, async request => {
  assertOwner(request);
  const { date, tz } = request.data ?? {};
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpsError('invalid-argument', 'date must be YYYY-MM-DD.');
  if (typeof tz !== 'string' || !isValidTimeZone(tz)) throw new HttpsError('invalid-argument', 'tz must be an IANA time zone.');
  try {
    return await assignDay(getFirestore(), githubToken.value(), date as IsoDate, tz);
  } catch (error) {
    logger.error('assign from commits failed', { date, error: String(error) });
    throw new HttpsError('unavailable', 'Could not read the commits from GitHub.');
  }
});
