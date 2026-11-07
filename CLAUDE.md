# CLAUDE.md

## Purpose

This application tracks **working hours per weekday**. It has three parts:

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

## Core UI expectations

- A weekday view (Mon–Fri) showing hours worked per day, broken down by project/task.
- Editing start/stop times and the project/task assignment of an entry.
- Managing projects and their (optional) tasks.

## Tech stack

- Angular 22 (standalone components), TypeScript 6
- Tailwind CSS 4 (via PostCSS)
- Firebase JS SDK (Firestore + Auth), exposed through injection tokens in `src/app/firebase/`
- Vitest for unit tests (`npm test`)
- Prettier: 100 char width, single quotes, Angular HTML parser

## Commands

- `npm run emulators`: start the Firebase emulators (UI at http://127.0.0.1:4100, Firestore 8180, Auth 9199). Data is saved to `.firebase-data/` on exit. The ports are non-default because the F2020 project's emulator uses the defaults.
- `npm run kill-ports`: stop emulator processes that won't die. Only touches processes started from this project, sends SIGTERM first (so data still exports) and SIGKILL after 8s. `-- --force` kills right away.
- `npm start`: dev server (`ng serve`). Expects the emulators to be running
- `npm run build`: production build
- `npm test`: run unit tests
