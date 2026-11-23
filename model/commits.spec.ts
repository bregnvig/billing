import { describe, expect, it } from 'vitest';
import { assignByCommits, Commit, commitSegments, commitWindowEnd, normalizeRepo, ruleFor, stillRetried, whyUnassigned } from './commits';
import type { Period, TimeEntry } from './entities';

/** Times on Fri 20 Nov, or `day` days later. */
const at = (hhmm: string, day = 0) => new Date(Date.UTC(2026, 10, 20 + day, ...(hhmm.split(':').map(Number) as [number, number])));
const dayStart = at('00:00');
const windowEnd = at('00:00', 4);
const now = new Date('2026-11-25T00:30:00Z');

const c = (repo: string, hhmm: string, day = 0): Commit => ({ repo, sha: `${repo}@${day}/${hhmm}`, at: at(hhmm, day) });
const rules = [
  { repo: 'acme/api', projectId: 'acme', taskId: 'api' },
  { repo: 'acme/web', projectId: 'acme', taskId: null },
  { repo: 'beta/app', projectId: 'beta', taskId: null },
];
const X = { projectId: 'acme', taskId: 'api' };
const Y = { projectId: 'beta', taskId: null };

const p = (id: string, from: string, to: string | null, type: Period['type'] = 'work'): Period => ({
  id,
  start: at(from),
  end: to === null ? null : at(to),
  type,
  source: 'hook',
});
const entry = (projectId: string | null, taskId: string | null, periods: Period[]): TimeEntry => ({
  id: `2026-11-20_${projectId ?? ''}_${taskId ?? ''}`,
  date: '2026-11-20',
  projectId,
  taskId,
  periods,
  note: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});
const spans = (e: TimeEntry | undefined) =>
  e?.periods.map(x => `${x.start.toISOString().slice(11, 16)}-${x.end!.toISOString().slice(11, 16)}`);

describe('normalizeRepo', () => {
  it('accepts owner/name, URLs and .git, in lower case', () => {
    expect(normalizeRepo('Acme/API')).toBe('acme/api');
    expect(normalizeRepo('https://github.com/acme/web.git')).toBe('acme/web');
    expect(normalizeRepo('git@github.com:acme/my_repo.js')).toBe('acme/my_repo.js');
  });
  it('rejects anything else', () => {
    expect(normalizeRepo('acme')).toBeNull();
    expect(normalizeRepo('a/b/c')).toBeNull();
    expect(normalizeRepo('')).toBeNull();
  });
});

describe('ruleFor', () => {
  it('finds the rule for a repo, case-insensitively', () => {
    expect(ruleFor(rules, 'ACME/api')).toEqual(X);
    expect(ruleFor(rules, 'other/repo')).toBeNull();
  });
});

describe('commit window', () => {
  it('looks 3 days past the day, so Friday is still tried after Monday', () => {
    expect(commitWindowEnd('2026-11-20')).toBe('2026-11-24');
    expect(stillRetried('2026-11-20', '2026-11-24')).toBe(true); // Tue 00:30 sees Mon's commits
    expect(stillRetried('2026-11-20', '2026-11-25')).toBe(false);
  });
});

describe('commitSegments', () => {
  it('gives each commit the time since the previous one, and leaves the time after the last one', () => {
    const segments = commitSegments([c('beta/app', '15:00'), c('acme/api', '13:00')], rules, dayStart, windowEnd);
    expect(segments.map(s => [s.start, s.end, s.assignment])).toEqual([
      [dayStart, at('13:00'), X],
      [at('13:00'), at('15:00'), Y],
    ]);
  });

  it("lets the next day's first commit claim the evening before", () => {
    const segments = commitSegments([c('acme/api', '13:00'), c('beta/app', '09:00', 1)], rules, dayStart, windowEnd);
    expect(segments.map(s => [s.start, s.end, s.assignment])).toEqual([
      [dayStart, at('13:00'), X],
      [at('13:00'), at('09:00', 1), Y],
    ]);
  });

  it('merges neighbouring stretches of the same project', () => {
    const segments = commitSegments([c('acme/api', '10:00'), c('acme/api', '12:00'), c('beta/app', '14:00')], rules, dayStart, windowEnd);
    expect(segments.map(s => [s.end, s.assignment])).toEqual([
      [at('12:00'), X],
      [at('14:00'), Y],
    ]);
  });

  it('makes a group of commits less than 15 minutes apart from several projects inconclusive', () => {
    const segments = commitSegments([c('acme/api', '10:00'), c('beta/app', '10:10'), c('acme/api', '13:00')], rules, dayStart, windowEnd);
    expect(segments.map(s => [s.start, s.end, s.assignment, s.repos])).toEqual([
      [dayStart, at('10:10'), null, ['acme/api', 'beta/app']],
      [at('10:10'), at('13:00'), X, ['acme/api']],
    ]);
  });

  it('treats commits exactly 15 minutes apart as separate', () => {
    const segments = commitSegments([c('acme/api', '10:00'), c('beta/app', '10:15')], rules, dayStart, windowEnd);
    expect(segments.map(s => s.assignment)).toEqual([X, Y]);
  });

  it('makes a repo without a rule inconclusive', () => {
    const segments = commitSegments([c('other/repo', '11:00')], rules, dayStart, windowEnd);
    expect(segments).toEqual([{ start: dayStart, end: at('11:00'), assignment: null, repos: ['other/repo'] }]);
  });

  it('ignores commits outside the window, and gives nothing without commits', () => {
    expect(commitSegments([c('acme/api', '10:00'), c('acme/api', '10:00', 4)], rules, at('11:00'), windowEnd)).toEqual([]);
    expect(commitSegments([], rules, dayStart, windowEnd)).toEqual([]);
  });

  it('treats repos with the same project and task as one project', () => {
    const segments = commitSegments([c('acme/web', '10:00'), c('acme/api', '10:05')], rules, dayStart, windowEnd);
    expect(segments[0].assignment).toBeNull(); // acme (no task) vs acme/api: different targets
    const same = commitSegments(
      [c('acme/api', '10:00'), c('acme/api2', '10:05')],
      [...rules, { repo: 'acme/api2', projectId: 'acme', taskId: 'api' }],
      dayStart,
      windowEnd,
    );
    expect(same.map(s => s.assignment)).toEqual([X]);
  });
});

describe('assignByCommits', () => {
  const day = (commits: Commit[]) => commitSegments(commits, rules, dayStart, windowEnd);

  it('splits an unassigned period where the project changes: 7 hours = 4 on X + 3 on Y', () => {
    const segments = day([c('acme/api', '13:00'), c('beta/app', '16:00')]);
    const outcome = assignByCommits([entry(null, null, [p('a', '09:00', '16:00')])], '2026-11-20', segments, now);
    const byId = new Map(outcome.writes.map(e => [e.id, e]));
    expect(spans(byId.get('2026-11-20_acme_api'))).toEqual(['09:00-13:00']);
    expect(spans(byId.get('2026-11-20_beta_'))).toEqual(['13:00-16:00']);
    expect(byId.get('2026-11-20_acme_api')!.periods[0].id).toBe('a');
    expect(outcome.deletes).toEqual(['2026-11-20__']);
    expect(outcome).toMatchObject({ assigned: 2, left: 0 });
  });

  it('leaves the time after the last commit unassigned until a later commit claims it', () => {
    const periods = () => [entry(null, null, [p('a', '09:00', '17:00')])];
    const first = assignByCommits(periods(), '2026-11-20', day([c('acme/api', '13:00')]), now);
    const byId = new Map(first.writes.map(e => [e.id, e]));
    expect(spans(byId.get('2026-11-20_acme_api'))).toEqual(['09:00-13:00']);
    expect(spans(byId.get('2026-11-20__'))).toEqual(['13:00-17:00']);
    expect(first).toMatchObject({ assigned: 1, left: 1 });

    // A later night: Monday's first commit (3 days later) says what Friday afternoon was.
    const later = assignByCommits([byId.get('2026-11-20__')!], '2026-11-20', day([c('acme/api', '13:00'), c('beta/app', '09:00', 3)]), now);
    expect(spans(later.writes.find(e => e.id === '2026-11-20_beta_'))).toEqual(['13:00-17:00']);
    expect(later.deletes).toEqual(['2026-11-20__']);
  });

  it('adds to existing entries and leaves assigned periods alone', () => {
    const assigned = entry('acme', 'api', [p('m', '07:00', '08:00')]);
    const outcome = assignByCommits(
      [assigned, entry(null, null, [p('a', '09:00', '10:00')])],
      '2026-11-20',
      day([c('acme/api', '13:00')]),
      now,
    );
    expect(spans(outcome.writes.find(e => e.id === assigned.id))).toEqual(['07:00-08:00', '09:00-10:00']);
  });

  it('keeps inconclusive time unassigned', () => {
    const mixed = day([c('acme/api', '10:00'), c('beta/app', '10:05'), c('beta/app', '12:00')]);
    const outcome = assignByCommits([entry(null, null, [p('a', '09:00', '11:00')])], '2026-11-20', mixed, now);
    const byId = new Map(outcome.writes.map(e => [e.id, e]));
    expect(spans(byId.get('2026-11-20__'))).toEqual(['09:00-10:05']);
    expect(spans(byId.get('2026-11-20_beta_'))).toEqual(['10:05-11:00']);
    expect(outcome).toMatchObject({ assigned: 1, left: 1 });
  });

  it('leaves breaks, running periods and days without commits alone', () => {
    const segments = day([c('acme/api', '18:00')]);
    const breakAndRunning = entry(null, null, [p('b', '12:00', '12:30', 'break'), p('r', '16:00', null)]);
    expect(assignByCommits([breakAndRunning], '2026-11-20', segments, now)).toEqual({
      writes: [],
      deletes: [],
      assigned: 0,
      left: 0,
      kept: 0,
    });
    const outcome = assignByCommits([entry(null, null, [p('a', '09:00', '10:00')])], '2026-11-20', [], now);
    expect(outcome).toEqual({ writes: [], deletes: [], assigned: 0, left: 1, kept: 0 });
  });

  it('does nothing without an unassigned entry', () => {
    const outcome = assignByCommits([entry('acme', 'api', [p('a', '09:00', '10:00')])], '2026-11-20', day([c('acme/api', '13:00')]), now);
    expect(outcome.writes).toEqual([]);
  });
});

describe('assignByCommits: marks and overwrite', () => {
  const day = (commits: Commit[]) => commitSegments(commits, rules, dayStart, windowEnd);
  const entryOn = (projectId: string | null, taskId: string | null, periods: Period[]) => entry(projectId, taskId, periods);

  it('marks what it assigns, and not what stays unassigned', () => {
    const outcome = assignByCommits([entryOn(null, null, [p('a', '09:00', '17:00')])], '2026-11-20', day([c('acme/api', '13:00')]), now);
    const byId = new Map(outcome.writes.map(e => [e.id, e]));
    expect(byId.get('2026-11-20_acme_api')!.periods[0].assignedBy).toBe('commits');
    expect(byId.get('2026-11-20__')!.periods[0].assignedBy).toBeUndefined();
  });

  it('without overwrite, leaves time assigned from commits alone', () => {
    const before = entryOn('acme', 'api', [{ ...p('a', '09:00', '13:00'), assignedBy: 'commits' }]);
    expect(assignByCommits([before], '2026-11-20', day([c('beta/app', '13:00')]), now).writes).toEqual([]);
  });

  it('with overwrite, redoes time assigned from commits (joining split pieces) by the current rules', () => {
    const x = entryOn('acme', 'api', [{ ...p('a', '09:00', '13:00'), assignedBy: 'commits' }]);
    const y = entryOn('beta', null, [{ ...p('a-1', '13:00', '17:00'), assignedBy: 'commits' }]);
    // Now everything up to 17:00 is on beta (a later commit, or a fixed rule).
    const outcome = assignByCommits([x, y], '2026-11-20', day([c('beta/app', '17:00')]), now, true);
    const byId = new Map(outcome.writes.map(e => [e.id, e]));
    expect(spans(byId.get('2026-11-20_beta_'))).toEqual(['09:00-17:00']);
    expect(byId.get('2026-11-20_beta_')!.periods[0]).toMatchObject({ id: 'a', assignedBy: 'commits' });
    expect(outcome.deletes).toEqual(['2026-11-20_acme_api']);
  });

  it('without overwrite, counts what it left alone', () => {
    const guessed = entryOn('acme', 'api', [p('h', '09:00', '13:00')]);
    expect(assignByCommits([guessed], '2026-11-20', day([c('beta/app', '13:00')]), now)).toMatchObject({ assigned: 0, left: 0, kept: 1 });
  });

  it("with overwrite, redoes the hook's periods on a project too (e.g. carried over from the day before)", () => {
    const guessed = entryOn('acme', 'api', [p('h', '09:00', '13:00')]);
    const outcome = assignByCommits([guessed], '2026-11-20', day([c('beta/app', '13:00')]), now, true);
    const byId = new Map(outcome.writes.map(e => [e.id, e]));
    expect(spans(byId.get('2026-11-20_beta_'))).toEqual(['09:00-13:00']);
    expect(outcome.deletes).toEqual(['2026-11-20_acme_api']);
    expect(outcome).toMatchObject({ assigned: 1, kept: 0 });
  });

  it('with overwrite, never touches periods you typed in by hand', () => {
    const typed = entryOn('acme', 'api', [{ ...p('m', '09:00', '13:00'), source: 'manual' }]);
    const outcome = assignByCommits([typed], '2026-11-20', day([c('beta/app', '17:00')]), now, true);
    expect(outcome).toMatchObject({ writes: [], assigned: 0, kept: 1 });
  });

  it('with overwrite, puts back what the commits no longer decide', () => {
    const x = entryOn('acme', 'api', [{ ...p('a', '09:00', '13:00'), assignedBy: 'commits' }]);
    const outcome = assignByCommits([x], '2026-11-20', [], now, true);
    const byId = new Map(outcome.writes.map(e => [e.id, e]));
    expect(spans(byId.get('2026-11-20__'))).toEqual(['09:00-13:00']);
    expect(byId.get('2026-11-20__')!.periods[0].assignedBy).toBeUndefined();
    expect(outcome.deletes).toEqual(['2026-11-20_acme_api']);
  });
});

describe('whyUnassigned', () => {
  const period = { start: at('09:00'), end: at('11:00') };
  const why = (commits: Commit[] | null, retrying = true) => whyUnassigned(period, commits, rules, dayStart, windowEnd, retrying);

  it('says when the commits have not been fetched', () => {
    expect(why(null)).toEqual({ kind: 'notFetched' });
  });

  it('waits for a later commit while the day is retried, then leaves it to you', () => {
    expect(why([])).toEqual({ kind: 'waiting' });
    expect(why([c('acme/api', '10:00')])).toEqual({ kind: 'waiting' }); // 10:00-11:00 isn't claimed yet
    expect(why([], false)).toEqual({ kind: 'manual' });
  });

  it('names the repos without a rule', () => {
    expect(why([c('other/repo', '10:00'), c('acme/api', '10:05'), c('acme/api', '12:00')])).toEqual({
      kind: 'unmapped',
      repos: ['other/repo'],
    });
  });

  it('names the repos of a mixed group', () => {
    expect(why([c('acme/api', '10:00'), c('beta/app', '10:05')])).toEqual({ kind: 'mixed', repos: ['acme/api', 'beta/app'] });
  });

  it('is pending when the commits decide it', () => {
    expect(why([c('acme/api', '12:00')])).toEqual({ kind: 'pending' });
    expect(why([c('acme/api', '09:00', 1)])).toEqual({ kind: 'pending' });
  });
});
