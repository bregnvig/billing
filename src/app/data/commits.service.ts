import { inject, Injectable } from '@angular/core';
import { Assignment, IsoDate, RepoRule } from '@loopme/model';
import { addDoc, deleteDoc, doc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { FIREBASE_FUNCTIONS, FIRESTORE } from '../firebase/firebase-data.providers';
import { repoRulesCollection } from './collections';

/** What `assignFromCommits` did (functions/src/assign-commits.ts). */
export interface AssignDayResult {
  commits: number;
  assigned: number;
  left: number;
  failedRepos: string[];
}

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
