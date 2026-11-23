/** Firestore collection names, shared so the web app, functions and rules agree. */
export const COLLECTIONS = {
  projects: 'projects',
  tasks: 'tasks',
  timeEntries: 'timeEntries',
  /** Read-only for the owner; written by Cloud Functions. */
  devices: 'devices',
  /** Cloud Functions only: `{sha256(token)} -> { deviceId }`. */
  deviceTokens: 'deviceTokens',
  /** Read-only for the owner; written by `reportEvent`. */
  hookEvents: 'hookEvents',
  /** Owner read/write: GitHub repo -> project/task rules (`RepoRule`). */
  repoRules: 'repoRules',
  /** Read-only for the owner; written by `assignFromCommits`: a day's commits (`CommitDay`, id = date). */
  commitDays: 'commitDays',
  /** Cloud Functions only: `{date} -> { result, tz, at }`, days whose last period `padDayEnds` handled. */
  dayEnds: 'dayEnds',
} as const;
