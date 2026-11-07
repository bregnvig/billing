import { collection, CollectionReference, Firestore } from 'firebase/firestore';
import { projectConverter, taskConverter, timeEntryConverter } from './converters';
import { Project, Task, TimeEntry } from './model';

export const COLLECTIONS = {
  projects: 'projects',
  tasks: 'tasks',
  timeEntries: 'timeEntries',
} as const;

export const projectsCollection = (db: Firestore): CollectionReference<Project> =>
  collection(db, COLLECTIONS.projects).withConverter(projectConverter);

export const tasksCollection = (db: Firestore): CollectionReference<Task> =>
  collection(db, COLLECTIONS.tasks).withConverter(taskConverter);

export const timeEntriesCollection = (db: Firestore): CollectionReference<TimeEntry> =>
  collection(db, COLLECTIONS.timeEntries).withConverter(timeEntryConverter);
