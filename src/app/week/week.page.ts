import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import {
  addDays,
  Assignment,
  dailyTotals,
  datesBetween,
  gapsBetween,
  IsoDate,
  isoWeek,
  PeriodRef,
  PeriodType,
  ProjectColor,
  startOfWeek,
  toIsoDate,
  weekdayIndex,
} from '@loopme/model';
import { TranslatePipe } from '@ngx-translate/core';
import { liveEntries, liveProjects, liveTasks } from '../data/live';
import { ProjectsService } from '../data/projects.service';
import { TimeEntriesService } from '../data/time-entries.service';
import { LanguageService } from '../i18n/language.service';
import { DayTimeline, TimelinePeriod } from '../overview/day-timeline';
import { injectNow } from '../ui/clock';
import { formatDay, formatDuration, formatLongDate, formatRange, formatTime } from '../ui/format';
import { Marker, PROJECT_COLORS } from '../ui/marker';
import { PickerResult, ProjectPicker } from '../ui/project-picker';
import { AddPeriodForm, NewPeriod } from './add-period-form';
import { ToastService } from '../ui/toast.service';

/** Local midnight of an IsoDate. */
const dayStart = (date: IsoDate): Date => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const isIsoDate = (value: string | undefined): value is IsoDate => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);

export interface PeriodRow extends TimelinePeriod {
  kind: 'period';
  ref: PeriodRef;
  /** `null` = unassigned. */
  projectId: string | null;
  taskId: string | null;
  durationMs: number;
  startText: string;
  endText: string | null;
}

/** Unrecorded time between periods (locked, asleep, away): can be counted as work. */
export interface GapRow {
  kind: 'gap';
  id: string;
  start: Date;
  end: Date;
  durationMs: number;
  startText: string;
  endText: string;
  /** Project/task of the period before the gap: what you were most likely working on. */
  assignment: Assignment;
}

/** What the picker is open for: one period, or all unassigned periods of a day. */
interface Editing {
  key: string;
  refs: PeriodRef[];
}

/** The week view: every period of the week, assignable to projects. */
@Component({
  selector: 'app-week-page',
  imports: [TranslatePipe, DayTimeline, Marker, ProjectPicker, AddPeriodForm],
  templateUrl: './week.page.html',
  styleUrl: './week.page.scss',
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class WeekPage {
  /** Monday of the week to show (`?w=2026-11-02`); defaults to this week. */
  readonly w = input<string>();
  /** `?assign=<date>`: open the picker for that day's unassigned periods (e.g. from the overview badge). */
  readonly assign = input<string>();

  readonly #router = inject(Router);
  readonly #entriesService = inject(TimeEntriesService);
  readonly #projectsService = inject(ProjectsService);
  readonly #toasts = inject(ToastService);
  readonly #locale = inject(LanguageService).locale;
  protected readonly now = injectNow();
  readonly #today = computed(() => toIsoDate(this.now()));

  protected readonly weekStart = computed(() => startOfWeek(isIsoDate(this.w()) ? (this.w() as IsoDate) : this.#today()));
  readonly #range = computed(() => ({ from: this.weekStart(), to: addDays(this.weekStart(), 6) }), {
    equal: (a, b) => a.from === b.from && a.to === b.to,
  });
  readonly #entries = liveEntries(this.#range);
  readonly #projectsLive = liveProjects();
  readonly #tasksLive = liveTasks();

  protected readonly projects = computed(() => this.#projectsLive.value() ?? []);
  protected readonly tasks = computed(() => this.#tasksLive.value() ?? []);
  protected readonly error = computed(() => this.#entries.error() ?? this.#projectsLive.error() ?? this.#tasksLive.error());
  protected readonly loaded = computed(() => this.#entries.value() !== null);
  protected readonly isThisWeek = computed(() => this.weekStart() === startOfWeek(this.#today()));

  protected readonly editing = signal<Editing | null>(null);
  /**
   * Days you opened or closed yourself (by date). Kept while you move between weeks; days without
   * a choice use their default (open when today or when they have unassigned time).
   */
  readonly #openChoices = signal(new Map<IsoDate, boolean>());

  constructor() {
    // Handle ?assign=<date> once the day's periods are loaded, then drop it from the URL so
    // going back or reloading doesn't reopen the picker.
    effect(() => {
      const date = this.assign();
      if (!date || !this.loaded()) return;
      untracked(() => {
        const day = this.days().find(d => d.date === date);
        if (day?.unassignedRefs.length) {
          const single = day.unassignedRefs.length === 1;
          this.#setOpen([day.date], true);
          this.openPicker(single ? day.unassignedRefs[0].periodId : `all-${date}`, day.unassignedRefs);
        }
        void this.#router.navigate([], { queryParams: { assign: null }, queryParamsHandling: 'merge', replaceUrl: true });
      });
    });
  }
  protected readonly busy = signal(false);
  /** Translation key of the last failed action. */
  protected readonly actionError = signal<string | null>(null);

  // --- Header ----------------------------------------------------------------------------

  protected readonly week = computed(() => isoWeek(this.weekStart()));
  protected readonly range = computed(() =>
    formatRange(dayStart(this.weekStart()), dayStart(addDays(this.weekStart(), 6)), this.#locale()),
  );
  readonly #totals = computed(() => dailyTotals(this.#entries.value() ?? [], this.now()));
  protected readonly weekWork = computed(() => [...this.#totals().values()].reduce((s, d) => s + d.work, 0));
  protected readonly weekUnassigned = computed(() => [...this.#totals().values()].reduce((s, d) => s + d.unassigned, 0));

  // --- Days ------------------------------------------------------------------------------

  readonly #names = computed(() => {
    const tasks = new Map(this.tasks().map(t => [t.id, t.name]));
    const projects = new Map(
      this.projects().map((p, i): [string, { name: string; color: ProjectColor }] => [
        p.id,
        { name: p.name, color: p.color ?? PROJECT_COLORS[i % PROJECT_COLORS.length] },
      ]),
    );
    return { projects, tasks };
  });

  protected readonly days = computed(() => {
    const entries = this.#entries.value() ?? [];
    const { projects, tasks } = this.#names();
    return (
      datesBetween(this.weekStart(), addDays(this.weekStart(), 6))
        .map(date => {
          const rows: PeriodRow[] = entries
            .filter(e => e.date === date)
            .flatMap(entry => {
              const project = entry.projectId ? projects.get(entry.projectId) : undefined;
              const task = entry.taskId ? tasks.get(entry.taskId) : undefined;
              return entry.periods.map(period => ({
                kind: 'period' as const,
                id: period.id,
                ref: { entryId: entry.id, periodId: period.id },
                start: period.start,
                end: period.end,
                type: period.type,
                projectId: entry.projectId,
                taskId: entry.taskId,
                color: project?.color ?? null,
                label: project ? (task ? `${project.name} / ${task}` : project.name) : null,
                labelKey: project ? null : entry.projectId ? 'timeline.unknownProject' : 'timeline.unassigned',
                durationMs: (period.end ?? this.now()).getTime() - period.start.getTime(),
                startText: formatTime(period.start),
                endText: period.end ? formatTime(period.end) : null,
              }));
            })
            .sort((a, b) => a.start.getTime() - b.start.getTime());
          const gaps: GapRow[] = gapsBetween(rows, this.now()).map(gap => {
            const before = rows.filter(r => r.start < gap.start && r.type === 'work').at(-1);
            return {
              kind: 'gap',
              id: `gap-${gap.start.getTime()}`,
              ...gap,
              durationMs: gap.end.getTime() - gap.start.getTime(),
              startText: formatTime(gap.start),
              endText: formatTime(gap.end),
              assignment: { projectId: before?.projectId ?? null, taskId: before?.taskId ?? null },
            };
          });
          const items: (PeriodRow | GapRow)[] = [...rows, ...gaps].sort((a, b) => a.start.getTime() - b.start.getTime());
          const byProject = new Map<string, { name: string; color: ProjectColor; work: number }>();
          for (const row of rows) {
            if (row.type !== 'work' || !row.projectId || !row.color) continue;
            const name = projects.get(row.projectId)?.name ?? '';
            const item = byProject.get(row.projectId) ?? { name, color: row.color, work: 0 };
            item.work += row.durationMs;
            byProject.set(row.projectId, item);
          }
          const total = this.#totals().get(date);
          return {
            date,
            start: dayStart(date),
            title: formatDay(dayStart(date), this.#locale()),
            longTitle: formatLongDate(dayStart(date), this.#locale()),
            isToday: date === this.#today(),
            work: total?.work ?? 0,
            unassigned: total?.unassigned ?? 0,
            rows,
            items,
            breakdown: [...byProject.values()].sort((a, b) => b.work - a.work),
            unassignedRefs: rows.filter(r => r.projectId === null && r.type === 'work').map(r => r.ref),
          };
        })
        .map(day => {
          const collapsible = day.rows.length > 0 && !day.isToday;
          const byDefault = day.isToday || day.unassigned >= this.minute;
          return { ...day, collapsible, open: !collapsible || (this.#openChoices().get(day.date) ?? byDefault) };
        })
        // Newest first, so today is at the top; days later in the week can't have time yet.
        .filter(day => day.rows.length > 0 || (day.date <= this.#today() && weekdayIndex(day.date) < 5))
        .reverse()
    );
  });

  // --- Actions ---------------------------------------------------------------------------

  protected readonly duration = formatDuration;
  /** Badges for unassigned time only from a minute up (a few seconds would read as 0:00). */
  protected readonly minute = 60_000;

  protected readonly goToWeek = (offset: number): void => {
    const target = offset === 0 ? null : addDays(this.weekStart(), offset * 7);
    const isCurrent = target === null || target === startOfWeek(this.#today());
    this.editing.set(null);
    void this.#router.navigate([], { queryParams: { w: isCurrent ? null : target }, replaceUrl: false });
  };

  protected readonly openPicker = (key: string, refs: PeriodRef[]): void => {
    // Acting on a collapsed day ("Add period", "Assign all", ?assign=…) opens it.
    const date = /^(?:add|all)-(\d{4}-\d{2}-\d{2})$/.exec(key)?.[1] as IsoDate | undefined;
    if (date) this.#setOpen([date], true);
    this.actionError.set(null);
    this.editing.set({ key, refs });
  };

  readonly #setOpen = (dates: IsoDate[], open: boolean): void =>
    this.#openChoices.update(choices => {
      const next = new Map(choices);
      for (const date of dates) next.set(date, open);
      return next;
    });

  protected readonly toggleDay = (date: IsoDate, open: boolean): void => {
    this.#setOpen([date], !open);
    if (open && this.editing()?.key.includes(date)) this.editing.set(null);
  };

  readonly #collapsible = computed(() => this.days().filter(d => d.collapsible));
  protected readonly hasCollapsible = computed(() => this.#collapsible().length > 0);
  protected readonly allOpen = computed(() => this.#collapsible().every(d => d.open));
  protected readonly toggleAll = (): void =>
    this.#setOpen(
      this.#collapsible().map(d => d.date),
      !this.allOpen(),
    );

  protected readonly closePicker = (returnFocusTo?: string): void => {
    this.editing.set(null);
    if (returnFocusTo) setTimeout(() => document.getElementById(returnFocusTo)?.focus());
  };

  /** Resolves a picker result to an assignment (creating the project if asked) and its display name. */
  readonly #resolve = async (result: PickerResult | null): Promise<{ target: Assignment; name: string | null }> => {
    if (!result) return { target: { projectId: null, taskId: null }, name: null };
    if ('createProject' in result) {
      const project = await this.#projectsService.createProject(result.createProject, this.projects());
      return { target: { projectId: project.id, taskId: null }, name: project.name };
    }
    const target = result.assign;
    let name = target.projectId ? (this.#names().projects.get(target.projectId)?.name ?? null) : null;
    if (name && target.taskId) name = `${name} / ${this.#names().tasks.get(target.taskId) ?? ''}`;
    return { target, name };
  };

  protected readonly onAddPeriod = async (date: IsoDate, period: NewPeriod): Promise<void> => {
    if (this.busy()) return;
    this.busy.set(true);
    this.actionError.set(null);
    try {
      const { target } = await this.#resolve(period.project);
      const undo = await this.#entriesService.addPeriod(date, target, { start: period.start, end: period.end, type: period.type });
      this.closePicker(`add-${date}`);
      this.#toasts.show({
        message: 'weekView.added',
        params: { start: formatTime(period.start), end: formatTime(period.end) },
        actionLabel: 'weekView.undo',
        action: () => undo().catch(() => this.actionError.set('weekView.errors.undo')),
      });
    } catch {
      this.actionError.set('weekView.errors.add');
    } finally {
      this.busy.set(false);
    }
  };

  protected readonly onPicked = async (result: PickerResult): Promise<void> => {
    const editing = this.editing();
    if (!editing || this.busy()) return;
    this.busy.set(true);
    this.actionError.set(null);
    try {
      const { target, name } = await this.#resolve(result);
      const undo = await this.#entriesService.assign(editing.refs, target);
      this.closePicker(editing.key);
      this.#toasts.show({
        message: name ? 'weekView.assignedTo' : 'weekView.unassignedDone',
        params: { count: editing.refs.length, name },
        actionLabel: 'weekView.undo',
        action: () => undo().catch(() => this.actionError.set('weekView.errors.undo')),
      });
    } catch {
      this.actionError.set('weekView.errors.assign');
    } finally {
      this.busy.set(false);
    }
  };

  /** Switches a period between work and break, with Undo. */
  protected readonly toggleType = async (row: PeriodRow): Promise<void> => {
    const type: PeriodType = row.type === 'break' ? 'work' : 'break';
    await this.#withUndo(
      () => this.#entriesService.setPeriodType(row.ref, type),
      type === 'work' ? 'weekView.countedAsWork' : 'weekView.markedAsBreak',
      {
        start: row.startText,
        end: row.endText ?? formatTime(this.now()),
      },
    );
  };

  /** Deletes a period (Undo puts it back exactly) and moves focus to the next period row. */
  protected readonly deleteRow = async (row: PeriodRow): Promise<void> => {
    const rowIds = this.days().flatMap(d => d.rows.map(r => r.id));
    const next = rowIds[rowIds.indexOf(row.id) + 1] ?? rowIds[rowIds.indexOf(row.id) - 1];
    if (this.editing()?.key === row.id) this.editing.set(null);
    await this.#withUndo(() => this.#entriesService.deletePeriod(row.ref), 'weekView.deleted', {
      start: row.startText,
      end: row.endText ?? formatTime(this.now()),
    });
    if (next) setTimeout(() => document.getElementById(next)?.focus());
  };

  /** Turns unrecorded time into a work period (on the project you were on before it), with Undo. */
  protected readonly countGapAsWork = (date: IsoDate, gap: GapRow): Promise<void> =>
    this.#withUndo(
      () => this.#entriesService.addPeriod(date, gap.assignment, { start: gap.start, end: gap.end, type: 'work' }),
      'weekView.countedAsWork',
      { start: gap.startText, end: gap.endText },
    );

  readonly #withUndo = async (
    action: () => Promise<() => Promise<unknown>>,
    message: string,
    params: Record<string, unknown>,
  ): Promise<void> => {
    if (this.busy()) return;
    this.busy.set(true);
    this.actionError.set(null);
    try {
      const undo = await action();
      this.#toasts.show({
        message,
        params,
        actionLabel: 'weekView.undo',
        action: () => undo().catch(() => this.actionError.set('weekView.errors.undo')),
      });
    } catch {
      this.actionError.set('weekView.errors.save');
    } finally {
      this.busy.set(false);
    }
  };

  /** ←/→ change week, T = today (ignored while typing or with modifiers). */
  protected readonly onKeydown = (event: KeyboardEvent): void => {
    const target = event.target as HTMLElement;
    if (event.altKey || event.ctrlKey || event.metaKey || target.closest('input, textarea, select, [role="combobox"]')) return;
    if (event.key === 'ArrowLeft') this.goToWeek(-1);
    else if (event.key === 'ArrowRight') this.goToWeek(1);
    else if (event.key === 't' || event.key === 'T') this.goToWeek(0);
    else return;
    event.preventDefault();
  };

  /** A = assign the focused period, B = switch it between break and work, Delete/Backspace = delete it. */
  protected readonly onRowKeydown = (event: KeyboardEvent, row: PeriodRow): void => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === 'a') this.openPicker(row.id, [row.ref]);
    else if (key === 'b') void this.toggleType(row);
    else if (key === 'delete' || key === 'backspace') void this.deleteRow(row);
    else return;
    event.preventDefault();
    event.stopPropagation();
  };
}
