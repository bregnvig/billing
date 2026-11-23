import { describe, expect, it } from 'vitest';
import { Commit } from '@loopme/model';
import { commitDayMap, dayCommits, dayStretches, reasonText, unassignedReason } from './commit-insight';

/** Local time on Fri 20 Nov 2026, or `days` later. */
const at = (h: number, m: number, days = 0) => new Date(2026, 10, 20 + days, h, m);
const c = (repo: string, h: number, m: number, days = 0): Commit => ({ repo, sha: `${repo}@${days}:${h}:${m}`, at: at(h, m, days) });
const P = 'dotnestech/polaris';
const C = 'dotnestech/cassiopeia';
const rules = [
  { repo: P, projectId: 'nestech', taskId: 'polaris' },
  { repo: C, projectId: 'nestech', taskId: 'cassiopeia' },
];

// Friday 20 Nov as it really was (06:49:xx to 07:04 was just under 15 minutes), and Monday's first commit.
const friday = [
  c(C, 6, 39),
  c(C, 6, 50),
  c(P, 7, 4),
  c(P, 7, 4),
  c(C, 7, 17),
  c(P, 7, 22),
  c(P, 7, 36),
  c(C, 9, 12),
  c(P, 10, 16),
  c('bregnvig/f2020', 11, 18),
  c('bregnvig/f2020', 11, 26),
  c(P, 13, 5),
  c(P, 13, 14),
];
const days = commitDayMap([
  { id: '2026-11-20', commits: friday, fetchedAt: at(0, 30, 3) },
  { id: '2026-11-23', commits: [c(C, 8, 55, 3)], fetchedAt: at(0, 30, 4) },
]);

describe('commit insight', () => {
  const day = dayCommits('2026-11-20', days, '2026-11-23');

  it('collects the day and the days after it, and knows it is still retried', () => {
    expect(day.commits).toHaveLength(14);
    expect(day.retrying).toBe(true);
    expect(dayCommits('2026-11-19', days, '2026-11-23').commits).toBeNull();
  });

  it("shows Friday's stretches with the commits behind them", () => {
    const stretches = dayStretches('2026-11-20', day, rules, at(9, 0, 3));
    expect(stretches.map(s => [s.start.getHours(), s.end.getHours(), s.kind, s.assignment?.taskId ?? null, s.repos])).toEqual([
      [0, 7, 'mixed', null, [C, P]],
      [7, 9, 'assigned', 'cassiopeia', [C]],
      [9, 10, 'assigned', 'polaris', [P]],
      [10, 11, 'unmapped', null, ['bregnvig/f2020']],
      [11, 13, 'assigned', 'polaris', [P]],
      [13, 8, 'assigned', 'cassiopeia', [C]], // Monday's first commit claims Friday afternoon
    ]);
    expect(stretches[0].commits).toHaveLength(7);
    expect(stretches[3].commits.map(x => x.repo)).toEqual(['bregnvig/f2020', 'bregnvig/f2020']);
  });

  it('adds the time no commit claims yet, once the day is over', () => {
    const fridayOnly = dayCommits(
      '2026-11-20',
      commitDayMap([{ id: '2026-11-20', commits: friday, fetchedAt: at(0, 30, 1) }]),
      '2026-11-21',
    );
    expect(dayStretches('2026-11-20', fridayOnly, rules, at(1, 0, 1)).at(-1)).toMatchObject({ start: at(13, 14), kind: 'waiting' });
  });

  it('explains an unassigned period', () => {
    expect(reasonText(unassignedReason({ start: at(10, 16), end: at(10, 33) }, day, rules))).toEqual({
      kind: 'unmapped',
      key: 'overview.needsProject.reason.unmapped',
      params: { repos: 'bregnvig/f2020' },
    });
  });
});
