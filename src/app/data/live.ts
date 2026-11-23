import { computed, DestroyRef, effect, inject, signal, Signal } from '@angular/core';
import { CommitDay, IsoDate, Project, RepoRule, Task, TimeEntry } from '@loopme/model';
import { documentId, onSnapshot, orderBy, Query, query, where } from 'firebase/firestore';
import { FIRESTORE } from '../firebase/firebase-data.providers';
import { commitDaysCollection, projectsCollection, repoRulesCollection, tasksCollection, timeEntriesCollection } from './collections';

export interface Live<T> {
  /** `null` while loading. */
  value: Signal<T | null>;
  error: Signal<string | null>;
}

/** Translation key. */
const OFFLINE = 'errors.offline';

/**
 * A query's documents, kept live. `source` is a signal for queries that change (e.g. a date range
 * at midnight): it re-subscribes then. Call in an injection context.
 */
const live = <T>(source: Signal<Query<T>> | Query<T>): Live<T[]> => {
  const value = signal<T[] | null>(null);
  const error = signal<string | null>(null);
  const subscribe = (q: Query<T>) =>
    onSnapshot(
      q,
      snapshot => {
        value.set(snapshot.docs.map(d => d.data()));
        error.set(null);
      },
      () => error.set(OFFLINE),
    );
  if (typeof source === 'function') {
    effect(onCleanup => onCleanup(subscribe(source())));
  } else {
    const unsubscribe = subscribe(source);
    inject(DestroyRef).onDestroy(unsubscribe);
  }
  return { value: value.asReadonly(), error: error.asReadonly() };
};

/** Time entries for days `from`..`to` (inclusive), kept live. Call in an injection context. */
export const liveEntries = (range: Signal<{ from: IsoDate; to: IsoDate }>): Live<TimeEntry[]> => {
  const db = inject(FIRESTORE);
  return live(computedQuery(range, ({ from, to }) => query(timeEntriesCollection(db), where('date', '>=', from), where('date', '<=', to))));
};

/** The fetched commits of days `from`..`to` (inclusive), kept live. Call in an injection context. */
export const liveCommitDays = (range: Signal<{ from: IsoDate; to: IsoDate }>): Live<CommitDay[]> => {
  const db = inject(FIRESTORE);
  return live(
    computedQuery(range, ({ from, to }) => query(commitDaysCollection(db), where(documentId(), '>=', from), where(documentId(), '<=', to))),
  );
};

/** All projects, kept live. Call in an injection context. */
export const liveProjects = (): Live<Project[]> => live(query(projectsCollection(inject(FIRESTORE)), orderBy('name')));

/** All tasks, kept live. Call in an injection context. */
export const liveTasks = (): Live<Task[]> => live(query(tasksCollection(inject(FIRESTORE)), orderBy('name')));

/** All repo → project/task rules, kept live. Call in an injection context. */
export const liveRepoRules = (): Live<RepoRule[]> => live(query(repoRulesCollection(inject(FIRESTORE)), orderBy('repo')));

/** A query that follows a signal: rebuilt (and re-subscribed) only when the signal changes. */
const computedQuery = <S, T>(source: Signal<S>, build: (value: S) => Query<T>): Signal<Query<T>> => computed(() => build(source()));
