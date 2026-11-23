import { describe, expect, it } from 'vitest';
import { commitsBetween, GitHubEvent, pushedHeads } from './github';

const from = new Date('2026-11-20T00:00:00Z');
const to = new Date('2026-11-21T00:00:00Z');
const push = (repo: string, at: string, head?: string, ref?: string): GitHubEvent => ({
  type: 'PushEvent',
  created_at: at,
  repo: { name: repo },
  payload: { head, ref },
});

describe('pushedHeads', () => {
  it('keeps pushes since `from`, once per repo and head, in lower case', () => {
    const events = [
      push('Acme/API', '2026-11-20T10:00:00Z', 'abc'),
      push('acme/api', '2026-11-20T11:00:00Z', 'abc'),
      push('acme/api', '2026-11-19T23:00:00Z', 'old'),
      { ...push('acme/api', '2026-11-20T12:00:00Z', 'x'), type: 'IssuesEvent' },
    ];
    expect(pushedHeads(events, from)).toEqual([{ repo: 'acme/api', head: 'abc' }]);
  });

  it('falls back to the branch when a push has no head', () => {
    expect(pushedHeads([push('acme/web', '2026-11-20T10:00:00Z', undefined, 'refs/heads/feat/x')], from)).toEqual([
      { repo: 'acme/web', head: 'feat/x' },
    ]);
  });
});

describe('commitsBetween', () => {
  it('keeps commits authored within the day', () => {
    const commits = [
      { sha: 'a', commit: { author: { date: '2026-11-20T09:00:00Z' } } },
      { sha: 'b', commit: { author: { date: '2026-11-19T22:00:00Z' } } },
      { sha: 'c', commit: { author: null } },
    ];
    expect(commitsBetween('acme/api', commits, from, to)).toEqual([{ repo: 'acme/api', sha: 'a', at: new Date('2026-11-20T09:00:00Z') }]);
  });
});
