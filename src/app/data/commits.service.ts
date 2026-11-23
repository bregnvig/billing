import { inject, Injectable } from '@angular/core';
import { Assignment, IsoDate, RepoRule } from '@loopme/model';
import { addDoc, deleteDoc, doc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { FIREBASE_FUNCTIONS, FIRESTORE } from '../firebase/firebase-data.providers';
import { Toast } from '../ui/toast.service';
import { repoRulesCollection } from './collections';

/** What `assignFromCommits` did (functions/src/assign-commits.ts). */
export interface AssignDayResult {
  commits: number;
  assigned: number;
  left: number;
  /** Finished work periods already on a project that were left as they are. */
  kept: number;
  failedRepos: string[];
}

/** The toast after a Sync: what it did, or why it did nothing. */
export const syncToast = (result: AssignDayResult, overwrite: boolean): Toast => {
  const params = { commits: result.commits, assigned: result.assigned, left: result.left, kept: result.kept };
  if (!result.commits) return { message: 'weekView.commits.none', params };
  if (result.assigned || result.left) return { message: 'weekView.commits.done', params };
  if (!result.kept) return { message: 'weekView.commits.nothing', params };
  return { message: overwrite ? 'weekView.commits.allTyped' : 'weekView.commits.allAssigned', params };
};

/** Assigning time from GitHub commits: the repo → project/task rules, and running the matching for a day.
 * Provided on the lazy shell route (it needs FIRESTORE and FIREBASE_FUNCTIONS, which only exist there).
 */
@Injectable()
export class CommitsService {
  readonly #db = inject(FIRESTORE);
  readonly #functions = inject(FIREBASE_FUNCTIONS);

  /**
   * Fetches the day's commits and assigns its unassigned time by them. `overwrite` first puts back
   * what was assigned from commits before, so it's matched again (never what you assigned yourself).
   */
  readonly assignDay = async (date: IsoDate, overwrite = false): Promise<AssignDayResult> => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const call = httpsCallable<{ date: IsoDate; tz: string; overwrite: boolean }, AssignDayResult>(this.#functions, 'assignFromCommits');
    return (await call({ date, tz, overwrite })).data;
  };

  /** Maps a repo (`owner/name`, already normalized) to a project/task. */
  readonly addRule = async (repo: string, assignment: Assignment): Promise<void> => {
    const now = new Date();
    const rule: RepoRule = { id: '', repo, projectId: assignment.projectId!, taskId: assignment.taskId, createdAt: now, updatedAt: now };
    await addDoc(repoRulesCollection(this.#db), rule);
  };

  readonly removeRule = (id: string): Promise<void> => deleteDoc(doc(repoRulesCollection(this.#db), id));
}
