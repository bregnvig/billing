import {
  DocumentData,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
  Timestamp,
} from 'firebase/firestore';
import { Project, Task, TimeEntry, Period } from './model';

const toTimestamp = (d: Date | null) => (d ? Timestamp.fromDate(d) : null);
const toDate = (t: unknown) => (t instanceof Timestamp ? t.toDate() : null);

const auditToFirestore = (m: { createdAt: Date; updatedAt: Date }) => ({
  createdAt: Timestamp.fromDate(m.createdAt),
  updatedAt: Timestamp.fromDate(m.updatedAt),
});
const auditFromFirestore = (data: DocumentData) => ({
  createdAt: toDate(data['createdAt'])!,
  updatedAt: toDate(data['updatedAt'])!,
});

export const projectConverter: FirestoreDataConverter<Project> = {
  toFirestore: ({ id: _id, ...p }: Project): DocumentData => ({ ...p, ...auditToFirestore(p) }),
  fromFirestore: (snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): Project => {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      name: data['name'],
      color: data['color'] ?? null,
      archived: data['archived'] ?? false,
      ...auditFromFirestore(data),
    };
  },
};

export const taskConverter: FirestoreDataConverter<Task> = {
  toFirestore: ({ id: _id, ...t }: Task): DocumentData => ({ ...t, ...auditToFirestore(t) }),
  fromFirestore: (snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): Task => {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      projectId: data['projectId'],
      name: data['name'],
      archived: data['archived'] ?? false,
      ...auditFromFirestore(data),
    };
  },
};

export const periodToFirestore = (p: Period): DocumentData => ({
  id: p.id,
  start: Timestamp.fromDate(p.start),
  end: toTimestamp(p.end),
  type: p.type,
  source: p.source,
});

const periodFromFirestore = (data: DocumentData): Period => ({
  id: data['id'],
  start: toDate(data['start'])!,
  end: toDate(data['end']),
  type: data['type'] ?? 'work',
  source: data['source'],
});

export const timeEntryConverter: FirestoreDataConverter<TimeEntry> = {
  toFirestore: ({ id: _id, ...e }: TimeEntry): DocumentData => ({
    ...e,
    periods: e.periods.map(periodToFirestore),
    ...auditToFirestore(e),
  }),
  fromFirestore: (snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): TimeEntry => {
    const data = snapshot.data(options);
    const periods = ((data['periods'] ?? []) as DocumentData[])
      .map(periodFromFirestore)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    return {
      id: snapshot.id,
      date: data['date'],
      projectId: data['projectId'] ?? null,
      taskId: data['taskId'] ?? null,
      periods,
      note: data['note'] ?? null,
      ...auditFromFirestore(data),
    };
  },
};
