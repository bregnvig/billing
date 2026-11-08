import { describe, expect, it } from 'vitest';
import { datesBetween, daysInMonth, isoWeek, startOfMonth, startOfPreviousMonth, startOfWeek, weekdayIndex } from './calendar';

describe('calendar', () => {
  it('starts weeks on Monday', () => {
    expect(weekdayIndex('2026-11-02')).toBe(0); // Monday
    expect(weekdayIndex('2026-11-08')).toBe(6); // Sunday
    expect(startOfWeek('2026-11-08')).toBe('2026-11-02');
    expect(startOfWeek('2026-11-02')).toBe('2026-11-02');
    expect(startOfWeek('2026-11-01')).toBe('2026-10-26');
  });

  it('computes ISO week numbers, including year edges', () => {
    expect(isoWeek('2026-11-08')).toBe(45);
    expect(isoWeek('2026-01-01')).toBe(1); // Thursday
    expect(isoWeek('2027-01-01')).toBe(53); // Friday, belongs to 2026-W53
    expect(isoWeek('2024-12-30')).toBe(1); // Monday of 2025-W01
  });

  it('handles months', () => {
    expect(startOfMonth('2026-11-08')).toBe('2026-11-01');
    expect(startOfPreviousMonth('2026-01-15')).toBe('2025-12-01');
    expect(daysInMonth('2026-02-10')).toBe(28);
    expect(daysInMonth('2028-02-10')).toBe(29);
  });

  it('lists days inclusively', () => {
    expect(datesBetween('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  });
});
