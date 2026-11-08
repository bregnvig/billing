import { describe, expect, it } from 'vitest';
import { addDays, isoDateIn, startOfDayIn } from './time';

const TZ = 'Europe/Copenhagen';
/** Copenhagen wall-clock time on a day (CET = UTC+1 in November). */
const cph = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+01:00`);

describe('time helpers', () => {
  it('uses the local day, not UTC', () => {
    // 23:30 in Copenhagen on the 5th is 22:30 UTC on the 5th; 00:30 local is still the 5th in UTC.
    expect(isoDateIn(cph('2026-11-05', '23:30'), TZ)).toBe('2026-11-05');
    expect(isoDateIn(cph('2026-11-06', '00:30'), TZ)).toBe('2026-11-06');
  });

  it('finds local midnight across DST changes', () => {
    expect(startOfDayIn('2026-11-06', TZ).toISOString()).toBe('2026-11-05T23:00:00.000Z');
    expect(startOfDayIn('2026-07-01', TZ).toISOString()).toBe('2026-06-30T22:00:00.000Z');
    // Day after the switch to summer time (29 March 2026)
    expect(startOfDayIn('2026-03-30', TZ).toISOString()).toBe('2026-03-29T22:00:00.000Z');
  });

  it('adds calendar days across months', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});
