import { describe, expect, it } from 'vitest';
import { assignByCommits, Commit, commitSegments, normalizeRepo, ruleFor, whyUnassigned } from './commits';
import type { Period, TimeEntry } from './entities';

const at = (hhmm: string) => new Date(`2026-11-20T${hhmm}:00Z`);
const dayStart = at('00:00');
const dayEnd = new Date('2026-11-21T00:00:00Z');
const now = new Date('2026-11-21T00:30:00Z');

const c = (repo: string, hhmm: string): Commit => ({ repo, sha: `${repo}@${hhmm}`, at: at(hhmm) });
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

describe('commitSegments', () => {
  it('gives each commit the time since the previous one, and the last one the rest of the day', () => {
    const segments = commitSegments([c('beta/app', '15:00'), c('acme/api', '13:00')], rules, dayStart, dayEnd);
    expect(segments.map(s => [s.start, s.end, s.assignment])).toEqual([
      [dayStart, at('13:00'), X],
      [at('13:00'), dayEnd, Y],
    ]);
  });

  it('merges neighbouring stretches of the same project', () => {
    const segments = commitSegments([c('acme/api', '10:00'), c('acme/api', '12:00'), c('beta/app', '14:00')], rules, dayStart, dayEnd);
    expect(segments.map(s => [s.end, s.assignment])).toEqual([
      [at('12:00'), X],
      [dayEnd, Y],
    ]);
  });

  it('makes a group of commits less than 15 minutes apart from several projects inconclusive', () => {
    const segments = commitSegments([c('acme/api', '10:00'), c('beta/app', '10:10'), c('acme/api', '13:00')], rules, dayStart, dayEnd);
    expect(segments.map(s => [s.start, s.end, s.assignment, s.repos])).toEqual([
      [dayStart, at('10:10'), null, ['acme/api', 'beta/app']],
      [at('10:10'), dayEnd, X, ['acme/api']],
    ]);
  });

  it('treats commits exactly 15 minutes apart as separate', () => {
    const segments = commitSegments([c('acme/api', '10:00'), c('beta/app', '10:15')], rules, dayStart, dayEnd);
    expect(segments.map(s => s.assignment)).toEqual([X, Y]);
  });

  it('makes a repo without a rule inconclusive', () => {
    const segments = commitSegments([c('other/repo', '11:00')], rules, dayStart, dayEnd);
    expect(segments).toEqual([{ start: dayStart, end: dayEnd, assignment: null, repos: ['other/repo'] }]);
  });

  it('ignores commits outside the day, and gives nothing without commits', () => {
    expect(commitSegments([c('acme/api', '10:00')], rules, at('11:00'), dayEnd)).toEqual([]);
    expect(commitSegments([], rules, dayStart, dayEnd)).toEqual([]);
  });

  it('treats repos with the same project and task as one project', () => {
    const segments = commitSegments([c('acme/web', '10:00'), c('acme/api', '10:05')], rules, dayStart, dayEnd);
    expect(segments[0].assignment).toBeNull(); // acme (no task) vs acme/api: different targets
    const same = commitSegments(
      [c('acme/api', '10:00'), c('acme/api2', '10:05')],
      [...rules, { repo: 'acme/api2', projectId: 'acme', taskId: 'api' }],
      dayStart,
      dayEnd,
    );
    expect(same.map(s => s.assignment)).toEqual([X]);
  });
});

describe('assignByCommits', () => {
  const segments = commitSegments([c('acme/api', '13:00'), c('beta/app', '15:00')], rules, dayStart, dayEnd);

  it('splits an unassigned period where the project changes: 7 hours = 4 on X + 3 on Y', () => {
    const outcome = assignByCommits([entry(null, null, [p('a', '09:00', '16:00')])], '2026-11-20', segments, now);
    const byId = new Map(outcome.writes.map(e => [e.id, e]));
    expect(spans(byId.get('2026-11-20_acme_api'))).toEqual(['09:00-13:00']);
    expect(spans(byId.get('2026-11-20_beta_'))).toEqual(['13:00-16:00']);
    expect(byId.get('2026-11-20_acme_api')!.periods[0].id).toBe('a');
    expect(outcome.deletes).toEqual(['2026-11-20__']);
    expect(outcome).toMatchObject({ assigned: 2, left: 0 });
  });

  it('adds to existing entries and leaves assigned periods alone', () => {
    const assigned = entry('acme', 'api', [p('m', '07:00', '08:00')]);
    const outcome = assignByCommits([assigned, entry(null, null, [p('a', '09:00', '10:00')])], '2026-11-20', segments, now);
    expect(spans(outcome.writes.find(e => e.id === assigned.id))).toEqual(['07:00-08:00', '09:00-10:00']);
  });

  it('keeps inconclusive time unassigned', () => {
    const mixed = commitSegments([c('acme/api', '10:00'), c('beta/app', '10:05'), c('beta/app', '12:00')], rules, dayStart, dayEnd);
    const outcome = assignByCommits([entry(null, null, [p('a', '09:00', '11:00')])], '2026-11-20', mixed, now);
    const byId = new Map(outcome.writes.map(e => [e.id, e]));
    expect(spans(byId.get('2026-11-20__'))).toEqual(['09:00-10:05']);
    expect(spans(byId.get('2026-11-20_beta_'))).toEqual(['10:05-11:00']);
    expect(outcome).toMatchObject({ assigned: 1, left: 1 });
  });

  it('leaves breaks, running periods and days without commits alone', () => {
    const day = entry(null, null, [p('b', '12:00', '12:30', 'break'), p('r', '16:00', null)]);
    expect(assignByCommits([day], '2026-11-20', segments, now)).toEqual({ writes: [], deletes: [], assigned: 0, left: 0 });
    const outcome = assignByCommits([entry(null, null, [p('a', '09:00', '10:00')])], '2026-11-20', [], now);
    expect(outcome).toEqual({ writes: [], deletes: [], assigned: 0, left: 1 });
  });

  it('does nothing without an unassigned entry', () => {
    expect(assignByCommits([entry('acme', 'api', [p('a', '09:00', '10:00')])], '2026-11-20', segments, now).writes).toEqual([]);
  });
});

describe('whyUnassigned', () => {
  const period = { start: at('09:00'), end: at('11:00') };
  const why = (commits: Commit[] | null) => whyUnassigned(period, commits, rules, dayStart, dayEnd);

  it('says when the commits have not been fetched, or there were none', () => {
    expect(why(null)).toEqual({ kind: 'notFetched' });
    expect(why([])).toEqual({ kind: 'noCommits' });
  });

  it('names the repos without a rule', () => {
    expect(why([c('other/repo', '10:00'), c('acme/api', '10:05')])).toEqual({ kind: 'unmapped', repos: ['other/repo'] });
  });

  it('names the repos of a mixed group', () => {
    expect(why([c('acme/api', '10:00'), c('beta/app', '10:05')])).toEqual({ kind: 'mixed', repos: ['acme/api', 'beta/app'] });
  });

  it('is pending when the commits decide it', () => {
    expect(why([c('acme/api', '10:00')])).toEqual({ kind: 'pending' });
  });
});
