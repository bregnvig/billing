import { describe, expect, it } from 'vitest';
import { HookEvent, startOfDayIn, TimeEntry, timeEntryId } from '@loopme/model';
import { applyEvent } from './events';

const TZ = 'Europe/Copenhagen';
const now = new Date('2026-11-05T12:00:00Z');
/** Copenhagen wall-clock time on a day (CET = UTC+1 in November). */
const cph = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+01:00`);

const event = (type: 'start' | 'stop', at: Date, eventId = `e-${at.getTime()}`): HookEvent => ({
  eventId,
  type,
  at,
  tz: TZ,
  reason: type === 'start' ? 'unlock' : 'lock',
});

const entry = (
  date: string,
  periods: TimeEntry['periods'],
  projectId: string | null = null,
): TimeEntry => ({
  id: timeEntryId(date as TimeEntry['date'], projectId, null),
  date: date as TimeEntry['date'],
  projectId,
  taskId: null,
  periods,
  note: null,
  createdAt: now,
  updatedAt: now,
});

const running = (id: string, start: Date) =>
  ({ id, start, end: null, type: 'work', source: 'hook' }) as const;

describe('applyEvent: start', () => {
  it("opens a running period in the day's unassigned entry", () => {
    const at = cph('2026-11-05', '08:02');
    const { result, writes } = applyEvent([], event('start', at, 'ev1'), now);
    expect(result).toBe('started');
    expect(writes).toHaveLength(1);
    expect(writes[0].id).toBe('2026-11-05__');
    expect(writes[0].periods).toEqual([running('ev1', at)]);
  });

  it('appends to an existing unassigned entry', () => {
    const existing = entry('2026-11-05', [
      {
        id: 'p1',
        start: cph('2026-11-05', '08:00'),
        end: cph('2026-11-05', '11:45'),
        type: 'work',
        source: 'hook',
      },
    ]);
    const { writes } = applyEvent(
      [existing],
      event('start', cph('2026-11-05', '12:15'), 'ev2'),
      now,
    );
    expect(writes[0].periods.map((p) => p.id)).toEqual(['p1', 'ev2']);
  });

  it('does nothing when a period is already running today, even if moved to a project', () => {
    const assigned = entry('2026-11-05', [running('p1', cph('2026-11-05', '08:00'))], 'acme');
    const outcome = applyEvent([assigned], event('start', cph('2026-11-05', '09:00')), now);
    expect(outcome).toEqual({ result: 'already-running', writes: [] });
  });

  it('closes a stale running period from an earlier day at the end of that day', () => {
    const stale = entry('2026-11-03', [running('old', cph('2026-11-03', '15:00'))]);
    const { result, writes } = applyEvent(
      [stale],
      event('start', cph('2026-11-05', '08:00'), 'ev3'),
      now,
    );
    expect(result).toBe('started');
    const closed = writes.find((w) => w.date === '2026-11-03')!;
    expect(closed.periods[0].end).toEqual(startOfDayIn('2026-11-04', TZ));
    expect(writes.find((w) => w.date === '2026-11-05')!.periods[0].id).toBe('ev3');
  });

  it('does not change the input entries', () => {
    const existing = entry('2026-11-05', []);
    applyEvent([existing], event('start', cph('2026-11-05', '08:00')), now);
    expect(existing.periods).toHaveLength(0);
  });
});

describe('applyEvent: stop', () => {
  it('closes the running period, wherever it was moved', () => {
    const assigned = entry('2026-11-05', [running('p1', cph('2026-11-05', '08:00'))], 'acme');
    const stopAt = cph('2026-11-05', '11:45');
    const { result, writes } = applyEvent([assigned], event('stop', stopAt), now);
    expect(result).toBe('stopped');
    expect(writes[0].id).toBe('2026-11-05_acme_');
    expect(writes[0].periods[0].end).toEqual(stopAt);
  });

  it('ignores a stop without a running period (e.g. sleep right after lock)', () => {
    const closed = entry('2026-11-05', [
      {
        id: 'p1',
        start: cph('2026-11-05', '08:00'),
        end: cph('2026-11-05', '11:45'),
        type: 'work',
        source: 'hook',
      },
    ]);
    expect(applyEvent([closed], event('stop', cph('2026-11-05', '11:46')), now)).toEqual({
      result: 'no-running-period',
      writes: [],
    });
  });

  it('ignores a stop before the running period started', () => {
    const e = entry('2026-11-05', [running('p1', cph('2026-11-05', '08:00'))]);
    expect(applyEvent([e], event('stop', cph('2026-11-05', '07:00')), now).result).toBe(
      'stop-before-start',
    );
  });

  it('splits work past midnight into both days, keeping project and task', () => {
    const late = entry('2026-11-05', [running('p1', cph('2026-11-05', '22:00'))], 'acme');
    const stopAt = cph('2026-11-06', '01:30');
    const { writes } = applyEvent([late], event('stop', stopAt), now);
    const midnight = startOfDayIn('2026-11-06', TZ);
    const day1 = writes.find((w) => w.date === '2026-11-05')!;
    const day2 = writes.find((w) => w.date === '2026-11-06')!;
    expect(day1.periods[0]).toMatchObject({ id: 'p1', end: midnight });
    expect(day2.id).toBe('2026-11-06_acme_');
    expect(day2.periods[0]).toMatchObject({
      id: 'p1-1',
      start: midnight,
      end: stopAt,
      source: 'hook',
    });
  });

  it('closes a running period from before yesterday at the end of its day instead of splitting', () => {
    const stale = entry('2026-11-02', [running('old', cph('2026-11-02', '15:00'))]);
    const { result, writes } = applyEvent([stale], event('stop', cph('2026-11-05', '17:00')), now);
    expect(result).toBe('closed-stale');
    expect(writes).toHaveLength(1);
    expect(writes[0].periods[0].end).toEqual(startOfDayIn('2026-11-03', TZ));
  });
});
