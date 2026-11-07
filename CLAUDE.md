# CLAUDE.md

## Purpose

**Loopme** tracks **working hours per weekday**. It has three parts:

1. **Frontend (this Angular app)**: shows the hours worked on each weekday and lets the user edit them.
2. **Firebase backend**: stores all data in Firestore. For now it runs only in the local emulator (demo project `demo-billing`, fake config).
3. **OS hooks**: small scripts/hooks on the user's machine that report when they *think* a workday started and stopped (e.g. login/unlock, logout/lock/suspend). These are best-effort guesses, so the UI is where they get corrected.

## Domain model

- **Project**: something hours can be booked against. Every time entry is booked on at most one project.
- **Task**: an optional subdivision of a project. A time entry may or may not reference a task.
- **Time entry**: all time on **one day** for one project + task combination. Document id is `{date}_{projectId}_{taskId}` (empty segments for null), see `timeEntryId()`.
  - Holds a list of **periods** (start/end), because the same project/task is often worked on several times a day.
  - Each period has a `type`: `work` or `break`. Breaks are recorded but don't count toward worked hours.
  - Each period has a `source`: `hook` (from the OS hooks) or `manual` (entered in the UI). All periods can be edited or deleted in the UI.
  - Hook periods land in the day's **unassigned** entry (`projectId: null`). The hooks only know when work started and stopped, so the user moves those periods to a project/task in the UI.
  - A running period has `end: null` until a stop is reported.

Types, Firestore converters and collection refs live in `src/app/data/`. Top-level collections: `projects`, `tasks` (with `projectId`), `timeEntries`.

## Auth

- Google sign-in only, and only **one allowed account**: `allowedEmail` in `src/app/firebase/firebase.config.ts`, duplicated in `firestore.rules` (keep both in sync). The email must be verified.
- `AuthService` (`src/app/auth/`) exposes `user` / `allowed` signals. `authGuard` protects everything under the `Shell` layout, and `loginGuard` keeps the allowed user off `/login`.
- In the emulator, "Sign in with Google" opens a fake account picker: add an account with the allowed email there.

## Core UI expectations

- A weekday view (Mon–Fri) showing hours worked per day, broken down by project/task.
- Editing start/stop times and the project/task assignment of an entry.
- Managing projects and their (optional) tasks.

## Tech stack

- Angular 22 (standalone components), TypeScript 6
- Tailwind CSS 4 (via PostCSS) + **SCSS** for all styles
  - `src/tailwind.css` is the one plain-CSS file: Tailwind 4 doesn't support Sass, so its `@import`, `@source` and `@theme` tokens (light values) live there.
  - `src/styles.scss` holds everything else: the `dark-tokens` mixin, base styles, icons. Component styles are `.scss` too.
  - Fonts (Roboto, Roboto Mono) and Material Symbols are self-hosted npm packages loaded via `angular.json` `styles`.
- Firebase JS SDK (Firestore + Auth), exposed through injection tokens in `src/app/firebase/`
- Vitest for unit tests (`npm test`)
- Prettier: 100 char width, single quotes, Angular HTML parser
- UI look and UX rules: the `ui-design` skill in `.claude/skills/` (Firebase-console style, Loopme teal accent, light + dark)

## Code conventions

- **Arrow functions only.** No `function` declarations and no method shorthand in object literals: `const toIsoDate = (d: Date) => …`, `{ fromFirestore: (snap) => … }`. Class methods are arrow-function properties too: `readonly save = () => …`.
  - Exception: Angular **lifecycle hooks** (`ngOnInit`, `ngOnChanges`, `ngOnDestroy`, `ngAfterViewInit`, …) must be real methods. Angular finds them on the prototype, so an arrow property would silently never run.
- **True privates.** Use `#field` / `#method = () => …` for anything private, never the `private` keyword.
  - Exception: members used in a **template** can't be `#private` (templates can't see them). Make those `protected`.
- Prefer `inject()` over constructor parameters, so services end up as `readonly #db = inject(FIRESTORE)`.

## Commands

- `npm run emulators`: start the Firebase emulators (UI at http://127.0.0.1:4100, Firestore 8180, Auth 9199). Data is saved to `.firebase-data/` on exit. The ports are non-default because the F2020 project's emulator uses the defaults.
- `npm run kill-ports`: force-kills whatever listens on this project's emulator ports (same approach as F2020, via `kill-port`). It's `kill -9`, so the emulator does **not** export data; prefer Ctrl+C and use this only when the emulator won't die.
- `npm start`: dev server (`ng serve`). Expects the emulators to be running
- `npm run build`: production build
- `npm test`: run unit tests
