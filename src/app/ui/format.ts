/**
 * Formatting for the UI (ui-design skill). Dates follow the UI locale: `Thu 5 Nov` (en-GB),
 * `tors. 5. nov.` (da-DK). Times are always 24-hour `08:02` and durations `7:30`.
 * Pass `LanguageService.locale()` so the output follows the chosen language.
 */
import type { Locale } from '../i18n/language.service';

const formatters = new Map<string, Intl.DateTimeFormat>();
const fmt = (locale: Locale, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat => {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = formatters.get(key);
  if (!f) formatters.set(key, (f = new Intl.DateTimeFormat(locale, options)));
  return f;
};

/** Named date parts, so both locales get our layout regardless of Intl's punctuation. */
const parts = (d: Date, locale: Locale, options: Intl.DateTimeFormatOptions) =>
  Object.fromEntries(
    fmt(locale, options)
      .formatToParts(d)
      .map(p => [p.type, p.value]),
  );

const pad = (n: number) => String(n).padStart(2, '0');

/** `08:02` */
export const formatTime = (d: Date): string => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** `Thu 5 Nov` / `tors. 5. nov.` */
export const formatDay = (d: Date, locale: Locale): string => {
  const p = parts(d, locale, { weekday: 'short', day: 'numeric', month: 'short' });
  return locale === 'da-DK' ? `${p['weekday']} ${p['day']}. ${p['month']}` : `${p['weekday']} ${p['day']} ${p['month']}`;
};

/** `Thu 5 Nov, 08:02`, with the year only when it isn't the current one. */
export const formatDateTime = (d: Date, locale: Locale, now = new Date()): string => {
  const year = d.getFullYear() === now.getFullYear() ? '' : ` ${d.getFullYear()}`;
  return `${formatDay(d, locale)}${year}, ${formatTime(d)}`;
};

/** `Thursday` / `torsdag` */
export const formatWeekday = (d: Date, locale: Locale): string => fmt(locale, { weekday: 'long' }).format(d);

/** `Thu` / `tor.` */
export const formatWeekdayShort = (d: Date, locale: Locale): string => fmt(locale, { weekday: 'short' }).format(d);

/** `November` / `november` */
export const formatMonth = (d: Date, locale: Locale): string => fmt(locale, { month: 'long' }).format(d);

/** `Thursday 5 November` / `torsdag 5. november` */
export const formatLongDate = (d: Date, locale: Locale): string =>
  locale === 'da-DK'
    ? `${formatWeekday(d, locale)} ${d.getDate()}. ${formatMonth(d, locale)}`
    : `${formatWeekday(d, locale)} ${d.getDate()} ${formatMonth(d, locale)}`;

/** `3–7 Nov`, `27 Oct – 2 Nov` / `3.–7. nov.`, `27. okt. – 2. nov.` */
export const formatRange = (from: Date, to: Date, locale: Locale): string => {
  const month = (d: Date) => fmt(locale, { month: 'short' }).format(d);
  const day = (d: Date) => (locale === 'da-DK' ? `${d.getDate()}.` : `${d.getDate()}`);
  return from.getMonth() === to.getMonth()
    ? `${day(from)}–${day(to)} ${month(to)}`
    : `${day(from)} ${month(from)} – ${day(to)} ${month(to)}`;
};

const MINUTE = 60_000;

/** `7:30`, `0:45`: hours and minutes, never decimals. */
export const formatDuration = (ms: number): string => {
  const minutes = Math.floor(Math.max(0, ms) / MINUTE);
  return `${Math.floor(minutes / 60)}:${pad(minutes % 60)}`;
};

/**
 * Change from `previous` to `current`: `+0:45`, `−1:10` (true minus sign), `±0:00`.
 * Both are floored to whole minutes first, like `formatDuration`, so the shown change always
 * matches the shown totals (0:06 vs 0:00 is +0:06, never +0:07).
 */
export const formatChange = (current: number, previous: number): string => {
  const minutes = Math.floor(Math.max(0, current) / MINUTE) - Math.floor(Math.max(0, previous) / MINUTE);
  const sign = minutes > 0 ? '+' : minutes < 0 ? '−' : '±';
  return `${sign}${formatDuration(Math.abs(minutes) * MINUTE)}`;
};
