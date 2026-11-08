import { DestroyRef, effect, inject, signal, Signal } from '@angular/core';
import { IsoDate, Project, Task, TimeEntry } from '@loopme/model';
import { onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { FIRESTORE } from '../firebase/firebase-data.providers';
import { projectsCollection, tasksCollection, timeEntriesCollection } from './collections';

export interface Live<T> {
  /** `null` while loading. */
  value: Signal<T | null>;
  error: Signal<string | null>;
}

/** Translation key. */
const OFFLINE = 'errors.offline';

/**
 * Time entries for days `from`..`to` (inclusive), kept live. Re-subscribes when the range
 * changes (e.g. at midnight). Call in an injection context.
 */
export const liveEntries = (range: Signal<{ from: IsoDate; to: IsoDate }>): Live<TimeEntry[]> => {
  const db = inject(FIRESTORE);
  const value = signal<TimeEntry[] | null>(null);
  const error = signal<string | null>(null);
  effect(onCleanup => {
    const { from, to } = range();
    const unsubscribe = onSnapshot(
      query(timeEntriesCollection(db), where('date', '>=', from), where('date', '<=', to)),
      snapshot => {
        value.set(snapshot.docs.map(d => d.data()));
        error.set(null);
      },
      () => error.set(OFFLINE),
    );
    onCleanup(unsubscribe);
  });
  return { value: value.asReadonly(), error: error.asReadonly() };
};

/** All projects, kept live. Call in an injection context. */
export const liveProjects = (): Live<Project[]> => {
  const value = signal<Project[] | null>(null);
  const error = signal<string | null>(null);
  const unsubscribe = onSnapshot(
    query(projectsCollection(inject(FIRESTORE)), orderBy('name')),
    snapshot => {
      value.set(snapshot.docs.map(d => d.data()));
      error.set(null);
    },
    () => error.set(OFFLINE),
  );
  inject(DestroyRef).onDestroy(unsubscribe);
  return { value: value.asReadonly(), error: error.asReadonly() };
};

/** All tasks, kept live. Call in an injection context. */
export const liveTasks = (): Live<Task[]> => {
  const value = signal<Task[] | null>(null);
  const error = signal<string | null>(null);
  const unsubscribe = onSnapshot(
    query(tasksCollection(inject(FIRESTORE)), orderBy('name')),
    snapshot => {
      value.set(snapshot.docs.map(d => d.data()));
      error.set(null);
    },
    () => error.set(OFFLINE),
  );
  inject(DestroyRef).onDestroy(unsubscribe);
  return { value: value.asReadonly(), error: error.asReadonly() };
};
