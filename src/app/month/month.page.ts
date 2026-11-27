import { Component, computed, inject, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { addDays, daysInMonth, IsoDate, monthSummary, ProjectColor, startOfMonth, startOfWeek, toIsoDate } from '@loopme/model';
import { TranslatePipe } from '@ngx-translate/core';
import { LiveCatalog } from '../data/live-catalog';
import { liveEntries } from '../data/live';
import { LanguageService } from '../i18n/language.service';
import { dayStart } from '../overview/dates';
import { injectNow } from '../ui/clock';
import { formatDuration, formatMonth, formatRange } from '../ui/format';
import { Marker, PROJECT_COLORS } from '../ui/marker';

const isMonth = (value: string | undefined): value is string => !!value && /^\d{4}-\d{2}$/.test(value);

/** The month view: the month's total per week, then a card per project with its tasks per week. */
@Component({
  selector: 'app-month-page',
  imports: [TranslatePipe, Marker, RouterLink, NgTemplateOutlet],
  templateUrl: './month.page.html',
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class MonthPage {
  /** Month to show (`?m=2026-11`); defaults to this month. */
  readonly m = input<string>();

  readonly #router = inject(Router);
  readonly #locale = inject(LanguageService).locale;
  readonly #catalog = inject(LiveCatalog);
  protected readonly now = injectNow();
  readonly #today = computed(() => toIsoDate(this.now()));

  protected readonly monthStart = computed(() => startOfMonth(isMonth(this.m()) ? (`${this.m()}-01` as IsoDate) : this.#today()));
  readonly #range = computed(() => ({ from: this.monthStart(), to: addDays(this.monthStart(), daysInMonth(this.monthStart()) - 1) }), {
    equal: (a, b) => a.from === b.from && a.to === b.to,
  });
  readonly #entries = liveEntries(this.#range);

  protected readonly error = computed(() => this.#entries.error() ?? this.#catalog.error());
  protected readonly loaded = computed(() => this.#entries.value() !== null);
  protected readonly isThisMonth = computed(() => this.monthStart() === startOfMonth(this.#today()));

  protected readonly title = computed(() => {
    const d = dayStart(this.monthStart());
    const month = formatMonth(d, this.#locale());
    return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${d.getFullYear()}`;
  });

  readonly #summary = computed(() => monthSummary(this.#entries.value() ?? [], this.monthStart(), this.now()));

  protected readonly weeks = computed(() =>
    this.#summary().weeks.map(w => ({
      ...w,
      range: formatRange(dayStart(w.from), dayStart(w.to), this.#locale()),
      link: { w: startOfWeek(w.from) },
    })),
  );

  protected readonly cards = computed(() => {
    const projects = new Map(
      this.#catalog
        .projects()
        .map((p, i): [string, { name: string; color: ProjectColor }] => [
          p.id,
          { name: p.name, color: p.color ?? PROJECT_COLORS[i % PROJECT_COLORS.length] },
        ]),
    );
    const taskNames = new Map(this.#catalog.tasks().map(t => [t.id, t.name]));
    const rows = this.#summary().rows;
    // One scale for all cards, so bars compare across projects.
    const max = Math.max(1, ...rows.flatMap(r => r.weeks));
    return rows.map(row => {
      const project = row.projectId ? projects.get(row.projectId) : undefined;
      const tasks = row.tasks.map(task => ({
        ...task,
        key: task.taskId ?? '',
        name: task.taskId ? (taskNames.get(task.taskId) ?? null) : null,
        labelKey: task.taskId ? 'monthView.unknownTask' : 'monthView.noTask',
      }));
      return {
        key: row.projectId ?? '',
        name: project?.name ?? null,
        labelKey: project ? null : row.projectId ? 'timeline.unknownProject' : 'timeline.unassigned',
        color: project?.color ?? null,
        bar: row.projectId === null ? 'var(--color-unassigned)' : `var(--color-project-${project?.color ?? 'blue'})`,
        total: row.total,
        weeks: row.weeks.map(ms => ({ ms, pct: (ms / max) * 100 })),
        // Only worth listing when the project's time is split, or sits on a task.
        tasks: tasks.length > 1 || tasks[0]?.taskId ? tasks : [],
      };
    });
  });
  protected readonly weekTotals = computed(() => this.#summary().weekTotals);
  protected readonly total = computed(() => this.#summary().total);
  protected readonly unassigned = computed(() => this.#summary().rows.find(r => r.projectId === null)?.total ?? 0);

  protected readonly duration = formatDuration;
  protected readonly minute = 60_000;

  protected readonly goToMonth = (offset: number): void => {
    const target = offset === 0 ? this.#today() : offset < 0 ? addDays(this.monthStart(), -1) : addDays(this.#range().to, 1);
    const month = target.slice(0, 7);
    void this.#router.navigate([], { queryParams: { m: month === this.#today().slice(0, 7) ? null : month } });
  };

  protected readonly onKeydown = (event: KeyboardEvent): void => {
    const target = event.target as HTMLElement;
    if (event.altKey || event.ctrlKey || event.metaKey || target.closest('input, textarea, select, [role="combobox"]')) return;
    if (event.key === 'ArrowLeft') this.goToMonth(-1);
    else if (event.key === 'ArrowRight') this.goToMonth(1);
    else if (event.key === 't' || event.key === 'T') this.goToMonth(0);
    else return;
    event.preventDefault();
  };
}
