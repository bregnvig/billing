/** Maps entries to and from Firestore documents (same shape as the web app's converter). */
import { DocumentData, Timestamp } from 'firebase-admin/firestore';
import { Period, TimeEntry } from '@loopme/model';

const toDate = (t: unknown): Date | null => (t instanceof Timestamp ? t.toDate() : null);
const toTs = (d: Date | null) => (d ? Timestamp.fromDate(d) : null);

export const entryFromDoc = (id: string, data: DocumentData): TimeEntry => ({
  id,
  date: data['date'],
  projectId: data['projectId'] ?? null,
  taskId: data['taskId'] ?? null,
  periods: ((data['periods'] ?? []) as DocumentData[]).map((p): Period => ({
    id: p['id'],
    start: toDate(p['start'])!,
    end: toDate(p['end']),
    type: p['type'] ?? 'work',
    source: p['source'] ?? 'manual',
  })),
  note: data['note'] ?? null,
  createdAt: toDate(data['createdAt']) ?? new Date(0),
  updatedAt: toDate(data['updatedAt']) ?? new Date(0),
});

export const entryToDoc = ({ id: _id, ...e }: TimeEntry): DocumentData => ({
  ...e,
  periods: e.periods.map((p) => ({ ...p, start: Timestamp.fromDate(p.start), end: toTs(p.end) })),
  createdAt: Timestamp.fromDate(e.createdAt),
  updatedAt: Timestamp.fromDate(e.updatedAt),
});
