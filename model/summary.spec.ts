import { describe, expect, it } from 'vitest';
import type { Period, TimeEntry } from './entities';
import { dailyTotals, runningPeriod, workMsBetween } from './summary';

const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00Z`);
const H = 3_600_000;
const p = (id: string, start: Date, end: Date | null, type: Period['type'] = 'work'): Period => ({
  id,
  start,
  end,
  type,
  source: 'hook',
});
const entry = (date: string, projectId: string | null, periods: Period[]): TimeEntry => ({
  id: `${date}_${projectId ?? ''}_`,
  date: date as TimeEntry['date'],
  projectId,
  taskId: null,
  periods,
  note: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

const entries = [
  entry('2026-11-05', 'acme', [p('a', at('2026-11-05', '08:00'), at('2026-11-05', '12:00'))]),
  entry('2026-11-05', null, [
    p('b', at('2026-11-05', '12:00'), at('2026-11-05', '12:30'), 'break'),
    p('c', at('2026-11-05', '12:30'), at('2026-11-05', '14:00')),
  ]),
  entry('2026-11-06', null, [p('d', at('2026-11-06', '09:00'), null)]),
];
const now = at('2026-11-06', '11:00');

describe('summary', () => {
  it('totals work per day, excluding breaks, with unassigned separately', () => {
    const totals = dailyTotals(entries, now);
    expect(totals.get('2026-11-05')).toEqual({ work: 5.5 * H, unassigned: 1.5 * H });
    expect(totals.get('2026-11-06')).toEqual({ work: 2 * H, unassigned: 2 * H });
  });

  it('clips work to a window and measures running periods up to now', () => {
    expect(workMsBetween(entries, at('2026-11-05', '10:00'), at('2026-11-05', '13:00'), now)).toBe(
      2.5 * H,
    );
    expect(workMsBetween(entries, at('2026-11-06', '00:00'), at('2026-11-07', '00:00'), now)).toBe(
      2 * H,
    );
  });

  it('finds the running period', () => {
    expect(runningPeriod(entries)?.period.id).toBe('d');
    expect(runningPeriod(entries.slice(0, 2))).toBeNull();
  });
});
