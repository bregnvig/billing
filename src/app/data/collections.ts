import { collection, CollectionReference, Firestore } from 'firebase/firestore';
import { projectConverter, taskConverter, timeEntryConverter } from './converters';
import { Project, Task, TimeEntry } from './model';

export const COLLECTIONS = {
  projects: 'projects',
  tasks: 'tasks',
  timeEntries: 'timeEntries',
} as const;

export function projectsCollection(db: Firestore): CollectionReference<Project> {
  return collection(db, COLLECTIONS.projects).withConverter(projectConverter);
}

export function tasksCollection(db: Firestore): CollectionReference<Task> {
  return collection(db, COLLECTIONS.tasks).withConverter(taskConverter);
}

export function timeEntriesCollection(db: Firestore): CollectionReference<TimeEntry> {
  return collection(db, COLLECTIONS.timeEntries).withConverter(timeEntryConverter);
}
