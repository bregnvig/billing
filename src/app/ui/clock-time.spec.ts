import { atClock, formatClock, parseClock } from './clock-time';

describe('clock time input', () => {
  it.each([
    ['0830', 510],
    ['830', 510],
    ['8:30', 510],
    ['08.30', 510],
    ['8', 480],
    ['17', 1020],
    ['24:00', 1440],
    ['0', 0],
  ])('parses %s', (text, minutes) => expect(parseClock(text)).toBe(minutes));

  it.each(['', 'abc', '8:3', '25', '24:01', '8:60', '12345', '-1'])('rejects %s', text => expect(parseClock(text)).toBeNull());

  it('formats and builds dates', () => {
    expect(formatClock(510)).toBe('08:30');
    expect(formatClock(1440)).toBe('24:00');
    expect(atClock(new Date(2026, 10, 8), 510)).toEqual(new Date(2026, 10, 8, 8, 30));
    expect(atClock(new Date(2026, 10, 8), 1440)).toEqual(new Date(2026, 10, 9, 0, 0));
  });
});
