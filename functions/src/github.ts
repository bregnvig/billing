/**
 * Your commits of a day, from GitHub. Uses a classic personal access token (`repo` scope, the
 * `GITHUB_TOKEN` secret), so private and organisation repos are included.
 *
 * GitHub has no "my commits on all branches" API, so:
 * 1. your recent events (`/users/{login}/events`, the last 300 / 30 days) give the branches you
 *    pushed to since the day started: repo + head commit of each push;
 * 2. for each, the commits you authored from that head back to the start of the day.
 * Commits are timed by their author date (when they were written, kept through rebases).
 * Commits pushed after the run are picked up by the next run (or Sync in the week view).
 */
import { Commit, normalizeRepo } from '@loopme/model';

const API = 'https://api.github.com';

/** The fields we use of a GitHub event. */
export interface GitHubEvent {
  type: string;
  created_at: string;
  repo: { name: string };
  payload: { head?: string; ref?: string };
}

/** The fields we use of a GitHub commit. */
export interface GitHubCommit {
  sha: string;
  commit: { author: { date: string } | null };
}

/** Repo + head of each push since `from`, without repeats. */
export const pushedHeads = (events: readonly GitHubEvent[], from: Date): { repo: string; head: string }[] => {
  const heads = new Map<string, { repo: string; head: string }>();
  for (const event of events) {
    if (event.type !== 'PushEvent' || new Date(event.created_at) < from) continue;
    const repo = normalizeRepo(event.repo.name);
    const head = event.payload.head ?? event.payload.ref?.replace(/^refs\/heads\//, '');
    if (repo && head) heads.set(`${repo}@${head}`, { repo, head });
  }
  return [...heads.values()];
};

/** Commits authored in [from, to), one per sha. */
export const commitsBetween = (repo: string, commits: readonly GitHubCommit[], from: Date, to: Date): Commit[] =>
  commits
    .filter(c => c.commit.author)
    .map(c => ({ repo, sha: c.sha, at: new Date(c.commit.author!.date) }))
    .filter(c => c.at >= from && c.at < to);

const get = async <T>(token: string, path: string): Promise<T> => {
  const response = await fetch(`${API}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'loopme',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!response.ok) throw new Error(`GitHub ${path.split('?')[0]}: ${response.status}`);
  return (await response.json()) as T;
};

/** Your commits authored in [from, to), across all repos and branches you pushed to. */
export const fetchCommits = async (token: string, from: Date, to: Date): Promise<{ commits: Commit[]; failedRepos: string[] }> => {
  const { login } = await get<{ login: string }>(token, '/user');

  const events: GitHubEvent[] = [];
  for (let page = 1; page <= 3; page++) {
    const batch = await get<GitHubEvent[]>(token, `/users/${encodeURIComponent(login)}/events?per_page=100&page=${page}`);
    events.push(...batch);
    // Newest first: stop once we're past the start of the day.
    if (batch.length < 100 || new Date(batch.at(-1)!.created_at) < from) break;
  }

  const bySha = new Map<string, Commit>();
  const failedRepos = new Set<string>();
  for (const { repo, head } of pushedHeads(events, from)) {
    const query = new URLSearchParams({ sha: head, author: login, since: from.toISOString(), per_page: '100' });
    try {
      const commits = await get<GitHubCommit[]>(token, `/repos/${repo}/commits?${query}`);
      for (const commit of commitsBetween(repo, commits, from, to)) bySha.set(commit.sha, commit);
    } catch {
      // A deleted branch or repo, or one the token can't read: the rest still counts.
      failedRepos.add(repo);
    }
  }
  return { commits: [...bySha.values()].sort((a, b) => a.at.getTime() - b.at.getTime()), failedRepos: [...failedRepos] };
};
