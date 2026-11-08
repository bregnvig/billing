---
name: ui-design
description: Visual style and UX rules for the billing (working-hours) app, which follows the Firebase console look (Material 3, Google style) with the Loopme teal accent, in light and dark. Use whenever building, changing or reviewing any UI in this project - components, templates, styles, forms, layouts, charts, tables, empty/loading/error states, or UI text.
---

# UI design for the working-hours app

A personal tool used daily, mostly to **check and correct** what the OS hooks recorded and to **assign time to projects**. Every rule below serves that: see the week at a glance, fix a period in seconds, trust the numbers.

## 1. Design direction: the Firebase console look

The app follows the **visual language of the Firebase console**: Google's Material 3 style for dashboards. The traits to copy:

- **Near-black canvas** (dark) / near-white canvas (light), with **rounded cards** (12px) on a slightly lighter surface, separated by a **1px subtle border**. No drop shadows on cards.
- **Big, light-weight headings**: page titles are large but **regular weight** (`f1-2024`, `Database`). Section headings are mid-size and **muted grey** (`Build`, `Get started`).
- **Metric cards**: icon + card title, then a small label with a muted qualifier (`Reads (current)`), then a **big number** with a small muted delta next to it (`7.7k +52.7%`), then a thin line chart.
- **Charts**: thin lines, **solid = this week, dashed = last week**, a dot on the latest point, minimal axes (only min/max/0 labels), legend bottom-right.
- **One accent color: Loopme teal** (from the app icon) instead of Firebase's Google blue: links, active tab text + underline, selected item bar, checkboxes, chart lines.
- **Pill controls**: dropdowns and secondary buttons are fully rounded pills (`Projects ▾`, `+ Add app`, `(default) ▾`).
- **Badges**: small pills with an outline or fill (`Blaze plan` amber outline, `Prod` red fill).
- **Data tables** inside cards: a slightly raised header band, thin row dividers, numbers right-aligned, ids/queries in monospace, pagination bottom-right (`1–7 of 7  ‹ ›`).
- **Left icon rail** for navigation (icons only, the active one in a rounded highlight), with the context (project/week) as a dropdown at the top left.
- **Dismissible info banner**: an outlined card with a blue info icon, a short message, a blue link and an `×`.
- **Material Symbols (Outlined)** icons, grey, 20-24px.
- **Two-line date range control**: calendar icon + `Last 24 hours` / `Nov 6 - Nov 7` + dropdown arrow.

**Not allowed**: the Firebase name, flame logo or any Google product branding. The app is **Loopme** with its own teal "L" icon (`public/loopme.svg`, `public/favicon.svg`). Firebase's typeface (Google Sans) isn't licensed for us, so use **Roboto** (the open Material font), which is close.

Also avoid: extra gradients (the only one allowed is the warm greeting heading, see below), shadows on cards, emoji icons, colored card backgrounds, and color as the only way a state is shown.

## 2. Design tokens

All values come from tokens: the light values are in `src/tailwind.css` under Tailwind 4's `@theme`, and the dark values are in the `dark-tokens` mixin in `src/styles.scss`. The block below shows them together for reference; the files are the source of truth. `tailwind.css` uses `@theme static` so every token is output even when no utility class uses it (tokens only used via `var()` in SCSS or style bindings, like the greeting gradient and project colors, would otherwise be missing in light mode). Never hard-code a color, font size, spacing or radius in a component. If a value is missing, add a token (with both light and dark values) instead.

```css
@import 'tailwindcss';

@theme {
  /* Light theme (default values) */
  --color-canvas: #f8f9fa;        /* page background */
  --color-rail: #f1f3f4;          /* left navigation rail */
  --color-surface: #ffffff;       /* cards */
  --color-raised: #f1f3f4;        /* table header band, rows inside cards, hover */
  --color-line: #c4c7c5;          /* card borders, dividers */
  --color-muted: #5f6368;         /* secondary text, section headings, axis labels */
  --color-ink: #1f1f1f;           /* primary text, numbers */

  --color-accent: #00796b;        /* Loopme teal, deepened for contrast: links, active tab, selection, focus, chart "this week" */
  --color-accent-soft: #e0f2f1;   /* selected item background, today */
  --color-on-accent: #ffffff;     /* text on filled accent buttons */

  /* Semantic: running/unassigned are for indicators, outlines, icons and badges (>= 3:1).
     Put their text labels in ink/muted next to them. */
  --color-running: #188038;       /* live period */
  --color-unassigned: #b06000;    /* needs a project */
  --color-danger: #c5221f;

  /* Warm greeting gradient: only for the page greeting ("Good morning, …") */
  --color-greet-from: #c26401;
  --color-greet-to: #d93025;

  /* Type */
  --font-sans: 'Roboto', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'Roboto Mono', ui-monospace, monospace;
  --text-xs: 0.75rem;     /* 12px: axis labels, pagination, deltas */
  --text-sm: 0.875rem;    /* 14px: base UI text, table cells, card body */
  --text-base: 1rem;      /* 16px: card titles */
  --text-xl: 1.5rem;      /* 24px: metric numbers, section headings */
  --text-3xl: 2rem;       /* 32px: page title */
  --text-5xl: 3rem;       /* 48px: greeting */

  /* Radius */
  --radius-sm: 4px;       /* checkboxes, period bars */
  --radius-md: 8px;       /* rows inside cards, inputs */
  --radius-lg: 12px;      /* cards, banners */
  /* pills use rounded-full */
}

:root {
  color-scheme: light dark;
}
:root[data-theme='light'] { color-scheme: light; }
:root[data-theme='dark'] { color-scheme: dark; }

/* Dark theme: applied when the user picks dark, or follows a dark system setting.
   Keep both blocks identical. */
:root[data-theme='dark'] {
  --color-canvas: #131314;
  --color-rail: #1b1b1c;
  --color-surface: #1e1f20;
  --color-raised: #282a2c;
  --color-line: #444746;
  --color-muted: #a8abae;
  --color-ink: #e3e3e3;
  --color-accent: #02a79e;
  --color-accent-soft: #1d3533;
  --color-on-accent: #00201d;
  --color-running: #81c995;
  --color-unassigned: #fdd663;
  --color-danger: #f28b82;
  --color-greet-from: #fbbc04;
  --color-greet-to: #f4511e;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    --color-canvas: #131314;
    --color-rail: #1b1b1c;
    --color-surface: #1e1f20;
    --color-raised: #282a2c;
    --color-line: #444746;
    --color-muted: #a8abae;
    --color-ink: #e3e3e3;
    --color-accent: #02a79e;
    --color-accent-soft: #1d3533;
    --color-on-accent: #00201d;
    --color-running: #81c995;
    --color-unassigned: #fdd663;
    --color-danger: #f28b82;
    --color-greet-from: #fbbc04;
    --color-greet-to: #f4511e;
  }
}
```

- **Spacing**: Tailwind's default 4px scale only (`1`=4px, `2`=8px, `3`=12px, `4`=16px, `6`=24px, `8`=32px). No arbitrary values like `p-[13px]`. Cards use `p-5`/`p-6`; the gap between cards is `gap-4`.
- **Fonts**: Roboto for everything, Roboto Mono only for ids/raw values. Headings are `font-normal`; only card titles and table headers go up to `font-medium`. All times and durations use `tabular-nums`.
- **Contrast**: all text tokens are checked at >= 4.5:1 on canvas, surface and raised in both themes. Semantic colors are >= 3:1 (for indicators). Re-check when changing a value.

### Project palette

Projects store a palette key (`ProjectColor` in `model/entities.ts`, imported as `@loopme/model`), not a hex value. Each key has a light and dark value **and a marker shape**, like the series markers in the Firebase charts, so projects can be told apart without color.

| Key | Light | Dark | Marker |
|---|---|---|---|
| `blue` | `#1a73e8` | `#8ab4f8` | ● circle |
| `orange` | `#e8710a` | `#fcad70` | ■ square |
| `pink` | `#d01884` | `#ff8bcb` | ◆ diamond |
| `brown` | `#8d5b3a` | `#d7a98b` | ▼ triangle down |
| `green` | `#188038` | `#81c995` | ▲ triangle up |
| `purple` | `#9334e6` | `#d7aefb` | ◗ half circle |
| `yellow` | `#b06000` | `#fdd663` | ✚ plus |
| `red` | `#d93025` | `#f28b82` | ★ star |

All are >= 3:1 on `surface` in their theme. Define them as `--color-project-<key>` tokens. A project is always shown as **marker + name**, never color alone. Projects with `color: null` get a key by their position in the list.

## 2a. Light and dark themes

Both themes are first-class. The Firebase screenshots are dark, and light follows the same structure with Google's light palette.

- **Three settings**: `Light`, `Dark`, `System` (the default), chosen under Settings > Appearance next to the language. The choice is stored in `localStorage` (a per-device preference, so not Firestore) and applied as `data-theme` on `<html>`. `System` removes the attribute so the media query decides.
- **Set it before Angular boots**: a tiny inline script in `index.html` reads `localStorage` and sets `data-theme`, so there's no flash of the wrong theme on load. Wrap it in try/catch.
- **Tokens do the work**: components use token classes (`bg-surface`, `text-ink`, `border-line`) and never Tailwind's `dark:` variant or raw colors. If something looks wrong in one theme, fix the token, not the component.
- **Layering**:
  - Dark: `canvas` (darkest) < `rail`/`surface` < `raised`. Rows inside a card can also be *darker* than the card (`canvas`), like the project list on the Firebase home page.
  - Light: `canvas` is light grey and cards are white, with borders doing the separating.
- **Accent changes per theme**: the exact brand teal `#02a79e` on dark, and a deeper teal `#00796b` on light (the brand teal is only ~2.8:1 on white). Filled accent buttons use `on-accent` text.
- **No cyan/teal project color**: it would be confused with the accent.
- **No pure black or pure white text**, and no `#000` backgrounds.
- **Check both**: every screen and state is checked in light *and* dark before it's done.

## 3. Layout

- **App shell** (like the Firebase console):
  - **Left icon rail** (`bg-rail`, 64px wide): app icon at the top, then `Week`, `Projects`, `Settings`. The active item gets an `accent-soft` rounded highlight. Every icon has a tooltip and an `aria-label`.
  - **Top-left context**: the week picker as a pill dropdown (`Week 45 ▾`), with `‹ ›` arrows and a `Today` pill next to it.
  - Content is centered with a max width of ~1200px and generous top padding.
- **Overview page** (landing, `/overview`): warm greeting + date/week subline, then metric cards: **Today** (full width, day timeline, running/unassigned badges), **This week** (bars per day, last week dashed) and **This month** (cumulative line, last month dashed). Changes compare against the same point in time.
- **Week page** (`/week?w=<Monday>`), for checking and assigning time:
  1. Week navigation: `‹ ›` pills, a `Today` pill when not on the current week, and the date range. Keys: `←/→` week, `T` today.
  2. Title `Week 45` (`text-3xl`, regular) with pill badges: `32:15 worked`, `1:20 unassigned` (amber, only from 1 minute up).
  3. **One card per day, newest first** (today at the top, accent border). Days later in the week are hidden; Sat/Sun only when they have time. Empty days are compact one-line cards.
  4. Day card: title, total, unassigned badge, `Assign all unassigned (n)` when there are several; then the day timeline and one row per period (marker + project / task, or amber ring + Unassigned; times; duration; Running badge).
  5. **Gaps** between periods (locked, asleep, away; at least a minute) show as hatched `Not recorded` rows with `Count as work`, which adds a work period on the project of the period before it. Every period row has a Break/Work switch (also key `B`) and a Delete button (also `Delete`/`Backspace`; focus moves to the next row). All offer Undo, never a confirm dialog.
  6. Clicking a row (or Enter / `A`) opens the **project picker inline** under it: type to filter or create a project, ↑/↓, Enter, Esc. Assigning shows a toast with Undo.
- **Projects page** (`/projects`): a "New project" field, then one card per project: marker + name (rename inline), color swatches (marker + color), Archive/Restore with Undo, and its tasks (name, default hours `08:00–16:00`, edit, archive) plus `Add task`. Archived projects and tasks are folded away behind a count. A task's default hours pre-fill the add-period form when that task is picked and the times are empty.
- **Responsive**:
  - Below 1024px the day cards wrap to 2-3 columns.
  - Below 768px the rail becomes a bottom navigation bar, the cards stack, and the day timeline gets a full-width row.
  - Must work at 360px with no horizontal page scroll. Wide tables scroll inside their card, like the Firebase query table.

## 4. Components

- **Card**: `bg-surface border border-line rounded-lg p-6`. Title row: 20px icon + `text-base` title. No shadow.
- **Buttons**:
  - Primary: filled `accent` pill with `on-accent` text. At most one per view.
  - Secondary: pill with `bg-raised` and no border (`+ Add period`).
  - Outlined: pill with a `line` border (dropdowns: `Projects ▾`).
  - Text: blue link-style.
  - Labels are verbs (`Assign`, `Add period`, `Split`), never `OK`/`Submit`.
- **Tabs**: text tabs with `accent` text + a 3px underline for the active one, and a `line` divider under the row. Vertical tabs (like `Latency` / `Read operations`) use a left `accent` bar + `accent-soft` background.
- **Inputs**: `bg-surface border-line rounded-md`, 40px tall, with a floating/top label. Focused: 2px `accent` border. Time inputs accept `0830`, `8:30`, `8.30` and normalise to `08:30` on blur.
- **Project picker**: a pill dropdown that opens a menu with a search field. Type to filter, arrow keys to move, Enter to pick. Each option shows marker + name + optional task in muted text. Recent projects first.
- **Period row** (edit popover/list): `[marker] Project / Task   08:02 – 11:45   3:43   [Work ▾]`. Every part can be edited inline.
- **Badge**: small pill, `text-xs`, outlined in the semantic color with `ink` text (e.g. `1:20 unassigned`), or filled for strong states.
- **Info banner**: outlined card, blue `info` icon, message, blue link, `×` to dismiss.
- **Popovers, not modals**, for editing a single period. Menus and popovers are the only things with a shadow.
- **Toasts**: bottom-centre, `raised` background, for `Saved` and undo (`Period deleted · Undo`, 6s).
- **Icons**: Material Symbols Outlined, 20px in rows and 24px in the rail, `text-muted` by default. They sit next to labels, or have an `aria-label` when alone.
- **Tables**: header band `bg-raised`, `text-xs font-medium text-muted`, may wrap to 2-3 lines. Rows are 56px with `line` dividers. Numbers right-aligned. Pagination bottom-right (`Items per page 10 ▾   1–7 of 7   ‹ ›`) only when needed.
- **Charts**: lines 2px. This week solid, last week dashed (`4 4`), a dot on the latest point. Gridlines only at max/mid/0 in `line`. Axis labels `text-xs text-muted`. Legend bottom-right with line samples (`— This week   - - Last week`). Multiple projects use palette colors **and** marker shapes.

## 5. Formatting

- **UI language**: English and Danish via ngx-translate. Never hard-code UI text: every string, aria-label and title is a key in `public/i18n/en.json` and `da.json` (see CLAUDE.md). Write Danish as natural Danish, not word-for-word.
- **Dates follow the language** (`Thu 5 Nov` / `tors. 5. nov.`), using the helpers in `src/app/ui/format.ts` with `LanguageService.locale()`.
- **Times**: 24-hour, `HH:mm` (`08:02`).
- **Durations**: `h:mm` (`7:30`, `0:45`). Never decimals in the UI. Running totals tick once a minute.
- **Deltas**: signed and muted (`+0:45`, `−1:10`). No green/red for "good/bad", since more hours isn't necessarily good.
- **Weeks**: start on Monday. Show the ISO week number (`Week 45`).
- **Dates**: `Thu 5 Nov`, plus the year only when it isn't the current one. Ranges as `3–7 Nov`.

## 6. States (define all of them for every screen)

| State | What the user sees |
|---|---|
| **Loading** | Skeleton shapes in the card layout (no spinners) after 200ms. Before 200ms, show nothing. |
| **Empty day** | Card shows `0:00` muted, `No time recorded` and an `Add period` text button. Weekends: hidden or blank. |
| **Unassigned time** | Amber-outlined bars + an amber badge in the day card and page header (`1:20 unassigned`). One click to assign. |
| **Running** | Green pulsing end on the bar, live duration, a `Running` badge, and a `Stop` action. |
| **Error / offline** | Info-banner style at the top, in `danger`: what happened + what to do (`Can't reach the database. Is the emulator running? Changes will sync when it's back.`). Never lose an edit. |
| **Saved** | Optimistic: the change shows instantly; a brief `Saved` toast only if it took longer than 1s. |

## 7. Interaction rules

- **Prevent errors instead of reporting them**: the end can't go before the start, overlapping periods are flagged while you edit, and a task picker only shows the chosen project's tasks.
- **Undo instead of confirm**: delete and move happen immediately and offer Undo. A confirmation dialog only for bulk deletes.
- **Instant feedback**: every action changes something visible within 100ms. Rely on Firestore's optimistic local writes.
- **Keyboard first** for correcting time:
  - `←/→` previous/next week, `T` today
  - `Tab` moves through periods, `Enter` edits, `Esc` cancels
  - `A` assigns the focused period, `Del` deletes it (with undo)
- **Assigning is the main job**: an unassigned period must be assignable in at most two actions (select period → pick project).
- **Splitting**: a period can be split at a time (e.g. to give 09:00-10:30 to another project). The two halves are adjacent and keep `source: 'hook'`.

## 8. Accessibility

- Text contrast at least 4.5:1, large numbers and UI parts at least 3:1, checked in **both** themes (the tokens above already pass; re-check any new value).
- Visible focus ring on everything focusable: 2px `accent` outline, 2px offset. Never `outline: none` without a replacement.
- Never show state by color alone: projects have marker shapes, unassigned has an outline + label, breaks are hatched, and running has a `Running` badge.
- Everything is doable by keyboard. Timeline bars are buttons with an `aria-label` like `Acme / API, 08:02 to 11:45, 3 hours 43 minutes`.
- Charts have a text alternative: the Projects table carries the same numbers.
- Respect `prefers-reduced-motion`: no pulsing, no transitions.
- Transitions are 150-200ms ease-out, on color/opacity/transform only.

## 9. UI text

- Short and specific: `3 periods unassigned`, not `There are some periods that need attention`.
- Errors: what happened + how to fix it.
- Sentence case everywhere (`Add period`, not `Add Period`).
- No exclamation marks, no jokes in errors.

## 10. Angular implementation conventions

- Standalone components, `OnPush` (the default), signals for state, `input()`/`output()` functions, built-in control flow (`@if`, `@for` with `track`).
- Forms: signal forms (`@angular/forms/signals`), see the `reference-signal-forms` skill.
- Style with Tailwind utility classes in templates, using the token names (`bg-surface`, `text-muted`, `border-line`, `text-accent`). Component **SCSS** files (`styleUrl: './x.scss'`) only for things Tailwind can't express, like the hatched break pattern, chart strokes or the timeline grid. Use `var(--color-…)` tokens there, never raw values.
- Shared UI pieces (card, pill button, badge, time input, project picker, period bar, marker, line chart) live in `src/app/ui/` and are reused, not re-styled per screen.
- Fonts and icons are self-hosted from npm packages, not loaded from a CDN at runtime: `@fontsource/roboto`, `@fontsource/roboto-mono`, and `material-symbols` (outlined).
- Code style (see CLAUDE.md): arrow functions only (except lifecycle hooks), `#private` members (template-bound members are `protected`).

## Checklist before calling UI work done

- [ ] It looks like it belongs in the Firebase console: rounded bordered cards, big regular-weight headings, muted section headings, blue accent, pill controls. But it has no Firebase/Google branding.
- [ ] All values come from tokens, with no hard-coded colors/sizes/spacing, no `dark:` variants, and any new token has both light and dark values.
- [ ] Loading, empty, error and unassigned/running states exist and were looked at.
- [ ] Works by keyboard alone, with focus always visible.
- [ ] Checked in **light and dark** (theme toggle and system setting), at 360px, 768px and 1280px.
- [ ] Times and durations use `tabular-nums` and the formats above.
- [ ] No state or project is shown by color alone.
- [ ] Button labels are verbs, and errors say how to fix them.
- [ ] All text is translated, with keys in both `en.json` and `da.json`, and checked in both languages.
