import { inject, Injectable } from '@angular/core';
import {
  addPeriod,
  Assignment,
  entryIdsForMove,
  IsoDate,
  movePeriods,
  PeriodRef,
  PeriodType,
  removePeriod,
  setPeriodType,
  TimeEntry,
  timeEntryId,
} from '@loopme/model';
import { doc, runTransaction } from 'firebase/firestore';
import { FIRESTORE } from '../firebase/firebase-data.providers';
import { timeEntriesCollection } from './collections';

/** Writes to time entries. Moves run in a transaction, so a period is never lost or duplicated.
 * Provided on the lazy shell route (it needs FIRESTORE, which only exists there).
 */
@Injectable()
export class TimeEntriesService {
  readonly #db = inject(FIRESTORE);

  /**
   * Assigns periods to a project/task (or `projectId: null` to unassign).
   * Resolves to an undo function that moves each period back where it came from.
   */
  readonly assign = async (refs: readonly PeriodRef[], target: Assignment): Promise<() => Promise<unknown>> => {
    const entries = timeEntriesCollection(this.#db);
    const origins = await runTransaction(this.#db, async tx => {
      const ids = entryIdsForMove(refs, target);
      const snapshots = await Promise.all(ids.map(id => tx.get(doc(entries, id))));
      const current = snapshots.filter(s => s.exists()).map(s => s.data()!);
      const changes = movePeriods(current, refs, target, new Date());
      for (const entry of changes.writes) tx.set(doc(entries, entry.id), entry);
      for (const id of changes.deletes) tx.delete(doc(entries, id));
      return originsOf(current, refs, target);
    });
    return () => Promise.all(origins.map(({ refs: back, assignment }) => this.assign(back, assignment)));
  };

  /** Adds a manual period. Resolves to an undo function that removes it again. */
  readonly addPeriod = async (
    date: IsoDate,
    assignment: Assignment,
    period: { start: Date; end: Date; type: PeriodType },
  ): Promise<() => Promise<unknown>> => {
    const entries = timeEntriesCollection(this.#db);
    const id = timeEntryId(date, assignment.projectId, assignment.projectId === null ? null : assignment.taskId);
    const periodId = crypto.randomUUID();
    await runTransaction(this.#db, async tx => {
      const snapshot = await tx.get(doc(entries, id));
      const entry = addPeriod(snapshot.data() ?? null, date, assignment, { id: periodId, ...period, source: 'manual' }, new Date());
      tx.set(doc(entries, id), entry);
    });
    return () => this.removePeriod({ entryId: id, periodId });
  };

  /** Switches a period between work and break. Resolves to an undo function. */
  readonly setPeriodType = async (ref: PeriodRef, type: PeriodType): Promise<() => Promise<unknown>> => {
    const entryRef = doc(timeEntriesCollection(this.#db), ref.entryId);
    const previous = await runTransaction(this.#db, async tx => {
      const snapshot = await tx.get(entryRef);
      const entry = snapshot.data();
      const before = entry?.periods.find(p => p.id === ref.periodId)?.type;
      const updated = entry && setPeriodType(entry, ref.periodId, type, new Date());
      if (!updated || !before) throw new Error('Period not found');
      tx.set(entryRef, updated);
      return before;
    });
    return () => this.setPeriodType(ref, previous);
  };

  /**
   * Deletes a period. Resolves to an undo function that puts the exact same period (id, times,
   * type, source) back into the same project/task entry, recreating the entry if needed.
   */
  readonly deletePeriod = async (ref: PeriodRef): Promise<() => Promise<unknown>> => {
    const entries = timeEntriesCollection(this.#db);
    const deleted = await runTransaction(this.#db, async tx => {
      const entryRef = doc(entries, ref.entryId);
      const entry = (await tx.get(entryRef)).data();
      const period = entry?.periods.find(p => p.id === ref.periodId);
      if (!entry || !period) throw new Error('Period not found');
      const updated = removePeriod(entry, ref.periodId, new Date());
      if (updated) tx.set(entryRef, updated);
      else tx.delete(entryRef);
      return { period, date: entry.date, assignment: { projectId: entry.projectId, taskId: entry.taskId } };
    });
    return () =>
      runTransaction(this.#db, async tx => {
        const entryRef = doc(entries, ref.entryId);
        const existing = (await tx.get(entryRef)).data() ?? null;
        if (existing?.periods.some(p => p.id === deleted.period.id)) return;
        tx.set(entryRef, addPeriod(existing, deleted.date, deleted.assignment, deleted.period, new Date()));
      });
  };

  /** Removes a period (deleting its entry if it's left empty). */
  readonly removePeriod = (ref: PeriodRef): Promise<void> =>
    runTransaction(this.#db, async tx => {
      const ref_ = doc(timeEntriesCollection(this.#db), ref.entryId);
      const snapshot = await tx.get(ref_);
      if (!snapshot.exists()) return;
      const updated = removePeriod(snapshot.data(), ref.periodId, new Date());
      if (updated) tx.set(ref_, updated);
      else tx.delete(ref_);
    });
}

/** For undo: where each moved period now is, grouped by the assignment it had before. */
const originsOf = (entries: TimeEntry[], refs: readonly PeriodRef[], target: Assignment) => {
  const groups = new Map<string, { assignment: Assignment; refs: PeriodRef[] }>();
  for (const ref of refs) {
    const source = entries.find(e => e.id === ref.entryId);
    if (!source?.periods.some(p => p.id === ref.periodId)) continue;
    const assignment = { projectId: source.projectId, taskId: source.taskId };
    const movedTo = timeEntryId(source.date, target.projectId, target.projectId === null ? null : target.taskId);
    if (movedTo === source.id) continue;
    const key = `${assignment.projectId}/${assignment.taskId}`;
    const group = groups.get(key) ?? { assignment, refs: [] };
    group.refs.push({ entryId: movedTo, periodId: ref.periodId });
    groups.set(key, group);
  }
  return [...groups.values()];
};
