import { collection, CollectionReference, Firestore } from 'firebase/firestore';
import { COLLECTIONS, Device, Project, Task, TimeEntry } from '@loopme/model';
import { deviceConverter, projectConverter, taskConverter, timeEntryConverter } from './converters';

export const projectsCollection = (db: Firestore): CollectionReference<Project> =>
  collection(db, COLLECTIONS.projects).withConverter(projectConverter);

export const tasksCollection = (db: Firestore): CollectionReference<Task> => collection(db, COLLECTIONS.tasks).withConverter(taskConverter);

export const timeEntriesCollection = (db: Firestore): CollectionReference<TimeEntry> =>
  collection(db, COLLECTIONS.timeEntries).withConverter(timeEntryConverter);

export const devicesCollection = (db: Firestore): CollectionReference<Device> =>
  collection(db, COLLECTIONS.devices).withConverter(deviceConverter);
