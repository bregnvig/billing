import { formatDateTime } from './format';

describe('formatDateTime', () => {
  const now = new Date(2026, 10, 7, 12, 0);

  it('shows weekday, day, month and 24-hour time', () => {
    expect(formatDateTime(new Date(2026, 10, 5, 8, 2), now)).toBe('Thu 5 Nov, 08:02');
  });

  it('adds the year only when it is not the current one', () => {
    expect(formatDateTime(new Date(2025, 11, 31, 17, 30), now)).toBe('Wed 31 Dec 2025, 17:30');
  });
});
