import { describe, expect, it } from 'vitest';
import { addPeriod, entryIdsForMove, movePeriods, overlapping, removePeriod } from './edit';
import type { Period, TimeEntry } from './entities';

const now = new Date('2026-11-08T12:00:00Z');
const p = (id: string, hh: number, end: number | null = hh + 1): Period => ({
  id,
  start: new Date(`2026-11-08T${String(hh).padStart(2, '0')}:00:00Z`),
  end: end === null ? null : new Date(`2026-11-08T${String(end).padStart(2, '0')}:00:00Z`),
  type: 'work',
  source: 'hook',
});
const entry = (projectId: string | null, taskId: string | null, periods: Period[]): TimeEntry => ({
  id: `2026-11-08_${projectId ?? ''}_${taskId ?? ''}`,
  date: '2026-11-08',
  projectId,
  taskId,
  periods,
  note: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

const unassigned = entry(null, null, [p('a', 8), p('b', 10), p('c', 13, null)]);

describe('movePeriods', () => {
  it('moves a period into a new project entry and keeps the rest', () => {
    const { writes, deletes } = movePeriods(
      [unassigned],
      [{ entryId: unassigned.id, periodId: 'b' }],
      { projectId: 'acme', taskId: null },
      now,
    );
    expect(deletes).toEqual([]);
    const source = writes.find(w => w.id === '2026-11-08__')!;
    const target = writes.find(w => w.id === '2026-11-08_acme_')!;
    expect(source.periods.map(x => x.id)).toEqual(['a', 'c']);
    expect(target).toMatchObject({ date: '2026-11-08', projectId: 'acme', taskId: null, createdAt: now });
    expect(target.periods).toEqual([p('b', 10)]);
  });

  it('moves several periods (incl. a running one), sorts them and deletes the emptied entry', () => {
    const existing = entry('acme', 'api', [p('x', 9)]);
    const refs = ['a', 'b', 'c'].map(periodId => ({ entryId: unassigned.id, periodId }));
    const { writes, deletes } = movePeriods([unassigned, existing], refs, { projectId: 'acme', taskId: 'api' }, now);
    expect(deletes).toEqual(['2026-11-08__']);
    expect(writes).toHaveLength(1);
    expect(writes[0].periods.map(x => x.id)).toEqual(['a', 'x', 'b', 'c']);
    expect(writes[0].periods[3].end).toBeNull();
  });

  it('unassigns (taskId is dropped with the project)', () => {
    const assigned = entry('acme', 'api', [p('x', 9)]);
    const { writes, deletes } = movePeriods([assigned], [{ entryId: assigned.id, periodId: 'x' }], { projectId: null, taskId: 'api' }, now);
    expect(deletes).toEqual(['2026-11-08_acme_api']);
    expect(writes[0]).toMatchObject({ id: '2026-11-08__', projectId: null, taskId: null });
  });

  it('skips periods already in the target or not found, and never changes its input', () => {
    const before = structuredClone(unassigned);
    expect(movePeriods([unassigned], [{ entryId: unassigned.id, periodId: 'a' }], { projectId: null, taskId: null }, now)).toEqual({
      writes: [],
      deletes: [],
    });
    expect(movePeriods([unassigned], [{ entryId: unassigned.id, periodId: 'nope' }], { projectId: 'acme', taskId: null }, now)).toEqual({
      writes: [],
      deletes: [],
    });
    movePeriods([unassigned], [{ entryId: unassigned.id, periodId: 'a' }], { projectId: 'acme', taskId: null }, now);
    expect(unassigned).toEqual(before);
  });

  it('lists the entries a move needs to read', () => {
    expect(entryIdsForMove([{ entryId: '2026-11-08__', periodId: 'a' }], { projectId: 'acme', taskId: null })).toEqual([
      '2026-11-08__',
      '2026-11-08_acme_',
    ]);
  });
});

describe('addPeriod / removePeriod / overlapping', () => {
  const manual = (id: string, hh: number, end: number): Period => ({ ...p(id, hh, end), source: 'manual' });

  it('adds a period to a new entry, or sorted into an existing one', () => {
    const fresh = addPeriod(null, '2026-11-08', { projectId: 'acme', taskId: null }, manual('m', 14, 15), now);
    expect(fresh).toMatchObject({ id: '2026-11-08_acme_', projectId: 'acme', createdAt: now, updatedAt: now });
    const merged = addPeriod(unassigned, '2026-11-08', { projectId: null, taskId: 'ignored' }, manual('m', 9, 10), now);
    expect(merged.periods.map(x => x.id)).toEqual(['a', 'm', 'b', 'c']);
    expect(unassigned.periods).toHaveLength(3);
  });

  it('removes a period, or signals delete when the entry is left empty', () => {
    expect(removePeriod(unassigned, 'b', now)?.periods.map(x => x.id)).toEqual(['a', 'c']);
    expect(removePeriod(entry('acme', null, [p('x', 9)]), 'x', now)).toBeNull();
  });

  it('finds overlaps, treating running periods as lasting until now', () => {
    const at = (hh: number) => new Date(`2026-11-08T${String(hh).padStart(2, '0')}:00:00Z`);
    expect(overlapping(unassigned.periods, at(9), at(10), now).map(x => x.id)).toEqual([]);
    expect(overlapping(unassigned.periods, at(8), at(11), now).map(x => x.id)).toEqual(['a', 'b']);
    expect(overlapping(unassigned.periods, at(11), at(12), now).map(x => x.id)).toEqual([]);
    const running = [p('r', 10, null)]; // running since 10:00; now is 12:00
    expect(overlapping(running, at(11), at(12), now).map(x => x.id)).toEqual(['r']);
    expect(overlapping(running, at(13), at(14), now).map(x => x.id)).toEqual([]);
  });
});
