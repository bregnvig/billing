/**
 * Clock-time input (ui-design skill): accepts `0830`, `8:30`, `8.30`, `830`, `8` and `24:00`,
 * and normalises to `08:30`. Values are minutes since midnight (0-1440).
 */
export const parseClock = (text: string): number | null => {
  const t = text.trim();
  let h: number;
  let m: number;
  const separated = /^(\d{1,2})[:.](\d{2})$/.exec(t);
  if (separated) {
    h = Number(separated[1]);
    m = Number(separated[2]);
  } else if (/^\d{1,4}$/.test(t)) {
    h = t.length <= 2 ? Number(t) : Number(t.slice(0, -2));
    m = t.length <= 2 ? 0 : Number(t.slice(-2));
  } else {
    return null;
  }
  if (m > 59 || h > 24 || (h === 24 && m > 0)) return null;
  return h * 60 + m;
};

/** `08:30` (and `24:00` for the end of the day). */
export const formatClock = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** The Date for `minutes` after local midnight of `day` (DST-safe). */
export const atClock = (day: Date, minutes: number): Date => new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutes);
