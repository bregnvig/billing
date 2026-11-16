import { describe, expect, it } from 'vitest';
import { Period, startOfDayIn, TimeEntry, timeEntryId } from '@loopme/model';
import { padDayEnd, paddedStart } from './day-edges';

const TZ = 'Europe/Copenhagen';
const now = new Date('2026-11-06T00:05:00+01:00');
/** Copenhagen wall-clock time on a day (CET = UTC+1 in November). */
const cph = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+01:00`);
const period = (id: string, from: string, to: string | null, extra: Partial<Period> = {}, date = '2026-11-05'): Period => ({
  id,
  start: cph(date, from),
  end: to ? cph(date, to) : null,
  type: 'work',
  source: 'hook',
  ...extra,
});
const entry = (periods: Period[], projectId: string | null = null, date = '2026-11-05'): TimeEntry => ({
  id: timeEntryId(date as TimeEntry['date'], projectId, null),
  date: date as TimeEntry['date'],
  projectId,
  taskId: null,
  periods,
  note: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

describe('paddedStart', () => {
  it("moves the day's first start 5 minutes earlier, but not before midnight", () => {
    expect(paddedStart([], cph('2026-11-05', '08:02'), '2026-11-05', TZ)).toEqual(cph('2026-11-05', '07:57'));
    expect(paddedStart([], cph('2026-11-05', '00:03'), '2026-11-05', TZ)).toEqual(startOfDayIn('2026-11-05', TZ));
  });

  it('leaves later starts alone, and ignores other days and empty entries', () => {
    const today = entry([period('p1', '08:00', '11:45')]);
    expect(paddedStart([today], cph('2026-11-05', '12:15'), '2026-11-05', TZ)).toEqual(cph('2026-11-05', '12:15'));
    const yesterday = entry([period('y', '09:00', '17:00', {}, '2026-11-04')], null, '2026-11-04');
    const empty = entry([]);
    expect(paddedStart([yesterday, empty], cph('2026-11-05', '08:02'), '2026-11-05', TZ)).toEqual(cph('2026-11-05', '07:57'));
  });
});

describe('padDayEnd', () => {
  it('adds 5 minutes to the period that ends last, across entries', () => {
    const unassigned = entry([period('a', '08:00', '12:00')]);
    const acme = entry([period('b', '13:00', '16:30')], 'acme');
    const { result, writes } = padDayEnd([acme, unassigned], '2026-11-05', TZ, now);
    expect(result).toBe('padded');
    expect(writes).toHaveLength(1);
    expect(writes[0].id).toBe(acme.id);
    expect(writes[0].periods[0].end).toEqual(cph('2026-11-05', '16:35'));
    expect(writes[0].updatedAt).toBe(now);
    expect(acme.periods[0].end).toEqual(cph('2026-11-05', '16:30')); // input untouched
  });

  it('never pads past midnight', () => {
    const late = entry([period('a', '20:00', '23:58')]);
    expect(padDayEnd([late], '2026-11-05', TZ, now).writes[0].periods[0].end).toEqual(startOfDayIn('2026-11-06', TZ));
    const atMidnight = entry([{ ...period('b', '20:00', null), end: startOfDayIn('2026-11-06', TZ) }]);
    expect(padDayEnd([atMidnight], '2026-11-05', TZ, now)).toEqual({ result: 'ends-at-midnight', writes: [] });
  });

  it('leaves the day alone when empty, still running, or ending with a break or a manual period', () => {
    expect(padDayEnd([], '2026-11-05', TZ, now).result).toBe('empty');
    expect(padDayEnd([entry([period('a', '08:00', '12:00'), period('b', '13:00', null)])], '2026-11-05', TZ, now).result).toBe('running');
    expect(
      padDayEnd([entry([period('a', '08:00', '12:00'), period('b', '12:00', '12:30', { type: 'break' })])], '2026-11-05', TZ, now).result,
    ).toBe('not-a-hook-period');
    expect(padDayEnd([entry([period('a', '08:00', '16:00', { source: 'manual' })])], '2026-11-05', TZ, now).result).toBe(
      'not-a-hook-period',
    );
  });

  it('only looks at the given day', () => {
    const other = entry([period('x', '08:00', '16:00', {}, '2026-11-04')], null, '2026-11-04');
    expect(padDayEnd([other], '2026-11-05', TZ, now).result).toBe('empty');
  });
});
