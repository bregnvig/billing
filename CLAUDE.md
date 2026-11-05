# CLAUDE.md

## Purpose

This application tracks **working hours per weekday**. It has three parts:

1. **Frontend (this Angular app)**: shows the hours worked on each weekday and lets the user edit them.
2. **Firebase backend**: stores all data in Firestore. For now it runs only in the local emulator (demo project `demo-billing`, fake config).
3. **OS hooks**: small scripts/hooks on the user's machine that report when they *think* a workday started and stopped (e.g. login/unlock, logout/lock/suspend). These are best-effort guesses, so the UI is where they get corrected.

## Domain model

- **Project**: something hours can be booked against. Every time entry belongs to exactly one project.
- **Task**: an optional subdivision of a project. A time entry may or may not reference a task.
- **Time entry / working period**: a start and stop time on a given day, assigned to a project and optionally a task.
  - Entries can be created automatically by the OS hooks or by hand in the UI.
  - All entries, including those from hooks, can be edited or deleted in the UI.

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
- `npm start`: dev server (`ng serve`). Expects the emulators to be running
- `npm run build`: production build
- `npm test`: run unit tests
