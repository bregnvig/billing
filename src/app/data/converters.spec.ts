import { QueryDocumentSnapshot, Timestamp } from 'firebase/firestore';
import { timeEntryConverter } from './converters';
import { entryDurationMs, TimeEntry, timeEntryId, toIsoDate } from '@loopme/model';

const at = (hhmm: string) => new Date(`2026-11-05T${hhmm}:00`);

const entry: TimeEntry = {
  id: timeEntryId('2026-11-05', 'acme', 'api'),
  date: '2026-11-05',
  projectId: 'acme',
  taskId: 'api',
  periods: [
    { id: 'p1', start: at('08:00'), end: at('11:45'), type: 'work', source: 'hook' },
    { id: 'b1', start: at('11:45'), end: at('12:15'), type: 'break', source: 'manual' },
    { id: 'p2', start: at('12:15'), end: null, type: 'work', source: 'manual' },
  ],
  note: null,
  createdAt: at('08:00'),
  updatedAt: at('12:15'),
};

const fakeSnapshot = (id: string, data: Record<string, unknown>): QueryDocumentSnapshot =>
  ({ id, data: () => ({ ...data }) }) as unknown as QueryDocumentSnapshot;

describe('timeEntryConverter', () => {
  it('stores period dates as Timestamps, keeps running ends null and drops the id', () => {
    const data = timeEntryConverter.toFirestore(entry);
    expect(data['id']).toBeUndefined();
    expect(data['periods'][0].start).toBeInstanceOf(Timestamp);
    expect(data['periods'][1].type).toBe('break');
    expect(data['periods'][2].end).toBeNull();
  });

  it('round-trips back to the original entry', () => {
    const data = timeEntryConverter.toFirestore(entry);
    expect(timeEntryConverter.fromFirestore(fakeSnapshot(entry.id, data))).toEqual(entry);
  });

  it('sorts periods by start on read', () => {
    const data = timeEntryConverter.toFirestore({
      ...entry,
      periods: [...entry.periods].reverse(),
    });
    const restored = timeEntryConverter.fromFirestore(fakeSnapshot(entry.id, data));
    expect(restored.periods.map((p) => p.id)).toEqual(['p1', 'b1', 'p2']);
  });
});

describe('model helpers', () => {
  it('builds deterministic ids, including the unassigned entry', () => {
    expect(timeEntryId('2026-11-05', 'acme', 'api')).toBe('2026-11-05_acme_api');
    expect(timeEntryId('2026-11-05', 'acme', null)).toBe('2026-11-05_acme_');
    expect(timeEntryId('2026-11-05', null, null)).toBe('2026-11-05__');
  });

  it('formats local dates', () => {
    expect(toIsoDate(new Date(2026, 0, 9, 23, 30))).toBe('2026-01-09');
  });

  it('sums work periods (excluding breaks), measuring running ones up to now', () => {
    // 3h45m closed + 15m running; the 30m break is not counted
    expect(entryDurationMs(entry, 'work', at('12:30'))).toBe((3 * 60 + 45 + 15) * 60_000);
    expect(entryDurationMs(entry, 'break', at('12:30'))).toBe(30 * 60_000);
  });

  it('defaults missing period type to work on read', () => {
    const data = timeEntryConverter.toFirestore(entry);
    delete data['periods'][0].type;
    const restored = timeEntryConverter.fromFirestore(fakeSnapshot(entry.id, data));
    expect(restored.periods[0].type).toBe('work');
  });
});
