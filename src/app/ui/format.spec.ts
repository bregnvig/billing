import {
  formatChange,
  formatDateTime,
  formatDay,
  formatDuration,
  formatLongDate,
  formatMonth,
  formatRange,
  formatTime,
  formatWeekday,
} from './format';

const thu = new Date(2026, 10, 5, 8, 2);
const now = new Date(2026, 10, 7, 12, 0);

describe('dates in English', () => {
  it('formats days, times and long dates', () => {
    expect(formatTime(thu)).toBe('08:02');
    expect(formatDay(thu, 'en-GB')).toBe('Thu 5 Nov');
    expect(formatDateTime(thu, 'en-GB', now)).toBe('Thu 5 Nov, 08:02');
    expect(formatDateTime(new Date(2025, 11, 31, 17, 30), 'en-GB', now)).toBe('Wed 31 Dec 2025, 17:30');
    expect(formatLongDate(thu, 'en-GB')).toBe('Thursday 5 November');
    expect(formatWeekday(thu, 'en-GB')).toBe('Thursday');
    expect(formatMonth(thu, 'en-GB')).toBe('November');
  });

  it('formats ranges', () => {
    expect(formatRange(new Date(2026, 10, 2), new Date(2026, 10, 8), 'en-GB')).toBe('2–8 Nov');
    expect(formatRange(new Date(2026, 9, 26), new Date(2026, 10, 1), 'en-GB')).toBe('26 Oct – 1 Nov');
  });
});

describe('dates in Danish', () => {
  it('formats days, times and long dates with Danish ordinal dots', () => {
    expect(formatDay(thu, 'da-DK')).toBe('tors. 5. nov.');
    expect(formatDateTime(thu, 'da-DK', now)).toBe('tors. 5. nov., 08:02');
    expect(formatLongDate(thu, 'da-DK')).toBe('torsdag 5. november');
    expect(formatMonth(thu, 'da-DK')).toBe('november');
  });

  it('formats ranges', () => {
    expect(formatRange(new Date(2026, 10, 2), new Date(2026, 10, 8), 'da-DK')).toBe('2.–8. nov.');
    expect(formatRange(new Date(2026, 9, 26), new Date(2026, 10, 1), 'da-DK')).toBe('26. okt. – 1. nov.');
  });
});

describe('durations', () => {
  it('formats hours and minutes', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(45 * 60_000)).toBe('0:45');
    expect(formatDuration((7 * 60 + 30) * 60_000 + 59_000)).toBe('7:30');
    expect(formatDuration(-5)).toBe('0:00');
  });

  it('formats signed changes that match the floored totals', () => {
    const min = 60_000;
    expect(formatChange(45 * min, 0)).toBe('+0:45');
    expect(formatChange(0, 70 * min)).toBe('−1:10');
    expect(formatChange(10_000, 0)).toBe('±0:00');
    // 6m50s vs 0: shown as 0:06, so the change is +0:06 (not rounded up to +0:07)
    expect(formatChange(6 * min + 50_000, 0)).toBe('+0:06');
  });
});
