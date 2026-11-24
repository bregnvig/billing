import { describe, expect, it } from 'vitest';
import { IsoDate, Period, TimeEntry } from '@loopme/model';
import { previousDayToResolve, unassignedPeriodsOn } from './previous-day';

const period = (date: string, from: string, to: string | null, type: Period['type'] = 'work'): Period => ({
  id: `${date}-${from}`,
  start: new Date(`${date}T${from}:00`),
  end: to ? new Date(`${date}T${to}:00`) : null,
  type,
  source: 'hook',
});
const entry = (date: IsoDate, projectId: string | null, periods: Period[]): TimeEntry => ({
  id: `${date}_${projectId ?? ''}_`,
  date,
  projectId,
  taskId: null,
  periods,
  note: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

describe('previousDayToResolve', () => {
  it('is the previous day you worked, skipping the weekend (Monday shows Friday)', () => {
    const friday = entry('2026-11-20', null, [period('2026-11-20', '09:00', '10:00')]);
    expect(previousDayToResolve([friday], '2026-11-23')).toBe('2026-11-20');
  });

  it('only while that day has unassigned time', () => {
    const friday = entry('2026-11-20', 'acme', [period('2026-11-20', '09:00', '17:00')]);
    const thursday = entry('2026-11-19', null, [period('2026-11-19', '09:00', '10:00')]);
    expect(previousDayToResolve([friday, thursday], '2026-11-23')).toBeNull();
  });

  it('ignores today, breaks and less than a minute', () => {
    const today = entry('2026-11-23', null, [period('2026-11-23', '08:00', '09:00')]);
    const friday = entry('2026-11-20', null, [period('2026-11-20', '12:00', '12:30', 'break'), period('2026-11-20', '13:00', '13:00')]);
    expect(previousDayToResolve([today, friday], '2026-11-23')).toBeNull();
    expect(previousDayToResolve([], '2026-11-23')).toBeNull();
  });
});

describe('unassignedPeriodsOn', () => {
  it("lists the day's finished unassigned work, oldest first", () => {
    const day = entry('2026-11-20', null, [
      period('2026-11-20', '13:00', '14:00'),
      period('2026-11-20', '09:00', '10:00'),
      period('2026-11-20', '15:00', null),
    ]);
    expect(unassignedPeriodsOn([day], '2026-11-20').map(p => p.period.id)).toEqual(['2026-11-20-09:00', '2026-11-20-13:00']);
  });
});
