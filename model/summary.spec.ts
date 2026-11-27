import { describe, expect, it } from 'vitest';
import type { Period, TimeEntry } from './entities';
import { dailyTotals, monthSummary, runningPeriod, workMsBetween } from './summary';

const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00Z`);
const H = 3_600_000;
const p = (id: string, start: Date, end: Date | null, type: Period['type'] = 'work'): Period => ({
  id,
  start,
  end,
  type,
  source: 'hook',
});
const entry = (date: string, projectId: string | null, periods: Period[], taskId: string | null = null): TimeEntry => ({
  id: `${date}_${projectId ?? ''}_${taskId ?? ''}`,
  date: date as TimeEntry['date'],
  projectId,
  taskId,
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
    expect(workMsBetween(entries, at('2026-11-05', '10:00'), at('2026-11-05', '13:00'), now)).toBe(2.5 * H);
    expect(workMsBetween(entries, at('2026-11-06', '00:00'), at('2026-11-07', '00:00'), now)).toBe(2 * H);
  });

  it('finds the running period', () => {
    expect(runningPeriod(entries)?.period.id).toBe('d');
    expect(runningPeriod(entries.slice(0, 2))).toBeNull();
  });
});

describe('monthSummary', () => {
  const month = [
    entry('2026-10-30', 'acme', [p('x', at('2026-10-30', '08:00'), at('2026-10-30', '16:00'))]), // October: ignored
    entry('2026-11-02', 'acme', [p('a', at('2026-11-02', '08:00'), at('2026-11-02', '12:00'))]),
    entry('2026-11-02', 'beta', [
      p('b', at('2026-11-02', '12:00'), at('2026-11-02', '12:30'), 'break'),
      p('c', at('2026-11-02', '12:30'), at('2026-11-02', '15:00')),
    ]),
    entry('2026-11-11', 'beta', [p('d', at('2026-11-11', '08:00'), at('2026-11-11', '16:00'))]),
    entry('2026-11-30', null, [p('e', at('2026-11-30', '09:00'), null)]),
  ];
  const summary = monthSummary(month, '2026-11-15', at('2026-11-30', '10:00'));

  it('splits the month into ISO weeks clipped to the month', () => {
    expect(summary.weeks).toEqual([
      { week: 44, from: '2026-11-01', to: '2026-11-01' },
      { week: 45, from: '2026-11-02', to: '2026-11-08' },
      { week: 46, from: '2026-11-09', to: '2026-11-15' },
      { week: 47, from: '2026-11-16', to: '2026-11-22' },
      { week: 48, from: '2026-11-23', to: '2026-11-29' },
      { week: 49, from: '2026-11-30', to: '2026-11-30' },
    ]);
  });

  it('totals work per project and week, most time first, unassigned last, breaks excluded', () => {
    expect(summary.rows.map(({ tasks, ...row }) => row)).toEqual([
      { projectId: 'beta', weeks: [0, 2.5 * H, 8 * H, 0, 0, 0], total: 10.5 * H },
      { projectId: 'acme', weeks: [0, 4 * H, 0, 0, 0, 0], total: 4 * H },
      { projectId: null, weeks: [0, 0, 0, 0, 0, 1 * H], total: 1 * H },
    ]);
    expect(summary.weekTotals).toEqual([0, 6.5 * H, 8 * H, 0, 0, 1 * H]);
    expect(summary.total).toBe(15.5 * H);
  });

  it('splits each project into its tasks, most time first, time without a task last', () => {
    const withTasks = monthSummary(
      [
        entry('2026-11-02', 'acme', [p('a', at('2026-11-02', '08:00'), at('2026-11-02', '09:00'))]),
        entry('2026-11-02', 'acme', [p('b', at('2026-11-02', '09:00'), at('2026-11-02', '11:00'))], 'api'),
        entry('2026-11-10', 'acme', [p('c', at('2026-11-10', '08:00'), at('2026-11-10', '11:00'))], 'web'),
        entry('2026-11-11', 'acme', [p('d', at('2026-11-11', '08:00'), at('2026-11-11', '10:00'))], 'api'),
        entry('2026-11-12', null, [p('e', at('2026-11-12', '08:00'), at('2026-11-12', '09:00'))]),
      ],
      '2026-11-01',
      now,
    );
    expect(withTasks.rows[0].tasks).toEqual([
      { taskId: 'api', weeks: [0, 2 * H, 2 * H, 0, 0, 0], total: 4 * H },
      { taskId: 'web', weeks: [0, 0, 3 * H, 0, 0, 0], total: 3 * H },
      { taskId: null, weeks: [0, 1 * H, 0, 0, 0, 0], total: 1 * H },
    ]);
    expect(withTasks.rows[1]).toMatchObject({ projectId: null, tasks: [] });
  });

  it('is empty without time', () => {
    const empty = monthSummary([], '2026-02-01', now);
    expect(empty.weeks.map(w => w.week)).toEqual([5, 6, 7, 8, 9]);
    expect(empty).toMatchObject({ rows: [], total: 0 });
  });
});
