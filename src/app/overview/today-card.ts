import { Component, computed, inject, input, signal } from '@angular/core';
import {
  addDays,
  Assignment,
  CARRY_OVER_DAYS,
  continuingAssignment,
  dailyTotals,
  PeriodRef,
  Project,
  ProjectColor,
  runningPeriod,
  Task,
  TimeEntry,
  toIsoDate,
  workMsBetween,
} from '@loopme/model';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ProjectsService } from '../data/projects.service';
import { TimeEntriesService } from '../data/time-entries.service';
import { LanguageService } from '../i18n/language.service';
import { formatChange, formatDay, formatDuration, formatTime, formatWeekday } from '../ui/format';
import { PROJECT_COLORS } from '../ui/marker';
import { MetricCard } from '../ui/metric-card';
import { PickerResult, ProjectPicker } from '../ui/project-picker';
import { ToastService } from '../ui/toast.service';
import { dayStart, shiftDays } from './dates';
import { DayTimeline, TimelinePeriod } from './day-timeline';

/**
 * The overview's Today card: time worked today against the same weekday last week, the day
 * timeline, and the actions for today: Start/Stop and assigning today's unassigned time.
 */
@Component({
  selector: 'app-today-card',
  imports: [MetricCard, DayTimeline, TranslatePipe, RouterLink, ProjectPicker],
  host: { '(document:pointerdown)': 'onDocumentPointerDown($event)' },
  templateUrl: './today-card.html',
})
export class TodayCard {
  /** Time entries from at least 7 days before today up to today. */
  readonly entries = input.required<TimeEntry[]>();
  readonly projects = input.required<Project[]>();
  readonly tasks = input.required<Task[]>();
  readonly now = input.required<Date>();

  readonly #entriesService = inject(TimeEntriesService);
  readonly #projectsService = inject(ProjectsService);
  readonly #toasts = inject(ToastService);
  readonly #locale = inject(LanguageService).locale;

  protected readonly today = computed(() => toIsoDate(this.now()));

  readonly #colorOf = computed(() => {
    const projects = this.projects();
    return new Map<string, { color: ProjectColor; name: string }>(
      projects.map((p, i) => [p.id, { color: p.color ?? PROJECT_COLORS[i % PROJECT_COLORS.length], name: p.name }]),
    );
  });

  protected readonly todayStart = computed(() => dayStart(this.today()));
  protected readonly todayLabel = computed(() => formatDay(this.now(), this.#locale()));
  protected readonly todayWork = computed(() => workMsBetween(this.entries(), this.todayStart(), this.now(), this.now()));
  protected readonly todayLastWeek = computed(() =>
    workMsBetween(this.entries(), shiftDays(this.todayStart(), -7), shiftDays(this.now(), -7), this.now()),
  );
  protected readonly todayUnassigned = computed(() => dailyTotals(this.entries(), this.now()).get(this.today())?.unassigned ?? 0);

  // --- Assign popover (from the unassigned badge) ------------------------------------------

  protected readonly assignOpen = signal(false);
  protected readonly assigning = signal(false);
  /** Translation key of a failed assign. */
  protected readonly assignError = signal<string | null>(null);
  /** Today's unassigned work periods, oldest first, as rows for the popover. */
  protected readonly unassignedRows = computed(() =>
    this.entries()
      .filter(e => e.date === this.today() && e.projectId === null)
      .flatMap(e =>
        e.periods
          .filter(p => p.type === 'work')
          .map(p => ({
            ref: { entryId: e.id, periodId: p.id },
            start: p.start,
            startText: formatTime(p.start),
            endText: p.end ? formatTime(p.end) : null,
            durationMs: (p.end ?? this.now()).getTime() - p.start.getTime(),
          })),
      )
      .sort((a, b) => a.start.getTime() - b.start.getTime()),
  );
  readonly #unassignedRefs = computed(() => this.unassignedRows().map(r => r.ref));
  protected readonly unassignedCount = computed(() => this.#unassignedRefs().length);

  protected readonly closeAssign = (returnFocus = false): void => {
    this.assignOpen.set(false);
    this.assignError.set(null);
    if (returnFocus) setTimeout(() => document.getElementById('assign-badge')?.focus());
  };

  /** Closes the popover on a click outside it. */
  protected readonly onDocumentPointerDown = (event: PointerEvent): void => {
    if (this.assignOpen() && !(event.target as HTMLElement).closest('.assign-popover-anchor')) this.closeAssign();
  };

  /** Deletes one unassigned period (Undo restores it); closes the popover when none are left. */
  protected readonly deleteUnassigned = async (row: { ref: PeriodRef; startText: string; endText: string | null }): Promise<void> => {
    if (this.assigning()) return;
    this.assigning.set(true);
    this.assignError.set(null);
    try {
      const undo = await this.#entriesService.deletePeriod(row.ref);
      this.#toasts.show({
        message: 'weekView.deleted',
        params: { start: row.startText, end: row.endText ?? formatTime(this.now()) },
        actionLabel: 'weekView.undo',
        action: () => undo(),
      });
      if (this.#unassignedRefs().every(r => r.periodId === row.ref.periodId)) {
        // Nothing left, so the badge disappears: put focus on the toast's Undo instead.
        this.closeAssign();
        setTimeout(() => document.querySelector<HTMLElement>('app-toast-host [role=status] button')?.focus());
      }
    } catch {
      this.assignError.set('weekView.errors.save');
    } finally {
      this.assigning.set(false);
    }
  };

  protected readonly assignToday = async (result: PickerResult): Promise<void> => {
    const refs = this.#unassignedRefs();
    if (!refs.length || this.assigning()) return;
    this.assigning.set(true);
    this.assignError.set(null);
    try {
      let target: Assignment;
      let name: string;
      if ('createProject' in result) {
        const project = await this.#projectsService.createProject(result.createProject, this.projects());
        target = { projectId: project.id, taskId: null };
        name = project.name;
      } else {
        target = result.assign;
        const project = this.projects().find(p => p.id === target.projectId);
        const task = this.tasks().find(t => t.id === target.taskId);
        name = project ? (task ? `${project.name} / ${task.name}` : project.name) : '';
      }
      const undo = await this.#entriesService.assign(refs, target);
      this.closeAssign(true);
      this.#toasts.show({
        message: 'weekView.assignedTo',
        params: { count: refs.length, name },
        actionLabel: 'weekView.undo',
        action: () => undo(),
      });
    } catch {
      this.assignError.set('weekView.errors.assign');
    } finally {
      this.assigning.set(false);
    }
  };

  protected readonly todayPeriods = computed((): TimelinePeriod[] => {
    const colors = this.#colorOf();
    return this.entries()
      .filter((e: TimeEntry) => e.date === this.today())
      .flatMap(e => {
        const project = e.projectId ? colors.get(e.projectId) : undefined;
        return e.periods.map(p => ({
          id: p.id,
          start: p.start,
          end: p.end,
          type: p.type,
          color: project?.color ?? null,
          label: project?.name ?? null,
          labelKey: project ? null : e.projectId ? 'timeline.unknownProject' : 'timeline.unassigned',
        }));
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  });

  protected readonly running = computed(() => {
    const r = runningPeriod(this.entries());
    return r
      ? {
          since: formatTime(r.period.start),
          ref: { entryId: r.entry.id, periodId: r.period.id },
          // Only today's: one from an earlier day (past midnight) is split by the hook's stop instead.
          stoppable: r.entry.date === this.today(),
        }
      : null;
  });

  // --- Manual start / stop ----------------------------------------------------------------------

  protected readonly clockBusy = signal(false);
  /** Translation key of a failed start or stop. */
  protected readonly clockError = signal<string | null>(null);

  /**
   * Starts a running work period now, when nothing is running (e.g. working without the hook,
   * or after a manual stop). Like the hook's start it continues the most recent work. The hook's
   * next stop (lock, sleep, logout) ends it; its next start is ignored while this one runs.
   */
  protected readonly start = async (): Promise<void> => {
    if (this.running() || this.clockBusy()) return;
    this.clockBusy.set(true);
    this.clockError.set(null);
    try {
      const start = new Date();
      const since = addDays(this.today(), -CARRY_OVER_DAYS);
      const target = continuingAssignment(
        this.entries().filter(e => e.date >= since),
        start,
      );
      const undo = await this.#entriesService.addPeriod(this.today(), target, { start, end: null, type: 'work' });
      const project = this.projects().find(p => p.id === target.projectId);
      const task = this.tasks().find(t => t.id === target.taskId);
      this.#toasts.show({
        message: project ? 'overview.startedOn' : 'overview.startedUnassigned',
        params: { time: formatTime(start), name: project ? (task ? `${project.name} / ${task.name}` : project.name) : '' },
        actionLabel: 'weekView.undo',
        action: () => undo(),
      });
    } catch {
      this.clockError.set('weekView.errors.save');
    } finally {
      this.clockBusy.set(false);
    }
  };

  /** Stops the running period now (e.g. done for the day without locking). Undo makes it run again. */
  protected readonly stop = async (): Promise<void> => {
    const r = this.running();
    if (!r?.stoppable || this.clockBusy()) return;
    this.clockBusy.set(true);
    this.clockError.set(null);
    try {
      const end = new Date();
      const undo = await this.#entriesService.stopPeriod(r.ref, end);
      this.#toasts.show({
        message: 'overview.stopped',
        params: { time: formatTime(end) },
        actionLabel: 'weekView.undo',
        action: () => undo(),
      });
      // The button disappears with the running period: put focus on the toast's Undo.
      setTimeout(() => document.querySelector<HTMLElement>('app-toast-host [role=status] button')?.focus());
    } catch {
      this.clockError.set('weekView.errors.save');
    } finally {
      this.clockBusy.set(false);
    }
  };

  protected readonly duration = formatDuration;
  protected readonly change = formatChange;
  protected readonly weekday = computed(() => formatWeekday(this.now(), this.#locale()));
}
