import { describe, expect, it } from 'vitest';
import { syncToast } from './commits.service';

const result = (r: Partial<{ commits: number; assigned: number; left: number; kept: number }>) => ({
  commits: 5,
  assigned: 0,
  left: 0,
  kept: 0,
  failedRepos: [],
  ...r,
});

describe('syncToast', () => {
  it('says what Sync did', () => {
    expect(syncToast(result({ assigned: 2, left: 1 }), false).message).toBe('weekView.commits.done');
    expect(syncToast(result({ commits: 0 }), false).message).toBe('weekView.commits.none');
  });

  it('says why nothing happened', () => {
    expect(syncToast(result({}), false).message).toBe('weekView.commits.nothing');
    expect(syncToast(result({ kept: 3 }), false).message).toBe('weekView.commits.allAssigned');
    expect(syncToast(result({ kept: 3 }), true).message).toBe('weekView.commits.allTyped');
  });
});
