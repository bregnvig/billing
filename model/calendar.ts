/**
 * Calendar arithmetic on `IsoDate` strings. Pure and time-zone free: an IsoDate is already
 * a local calendar day. Weeks start on Monday (ISO 8601).
 */
import type { IsoDate } from './entities';
import { addDays } from './time';

const parse = (date: IsoDate) => {
  const [y, m, d] = date.split('-').map(Number);
  return { y, m, d, utc: new Date(Date.UTC(y, m - 1, d)) };
};
const pad = (n: number) => String(n).padStart(2, '0');

/** 0 = Monday … 6 = Sunday. */
export const weekdayIndex = (date: IsoDate): number => (parse(date).utc.getUTCDay() + 6) % 7;

/** The Monday of the week `date` is in. */
export const startOfWeek = (date: IsoDate): IsoDate => addDays(date, -weekdayIndex(date));

export const startOfMonth = (date: IsoDate): IsoDate => {
  const { y, m } = parse(date);
  return `${y}-${pad(m)}-01`;
};

export const daysInMonth = (date: IsoDate): number => {
  const { y, m } = parse(date);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/** First day of the month before `date`'s month. */
export const startOfPreviousMonth = (date: IsoDate): IsoDate => startOfMonth(addDays(startOfMonth(date), -1));

/** ISO 8601 week number (1-53). */
export const isoWeek = (date: IsoDate): number => {
  const thursday = parse(addDays(date, 3 - weekdayIndex(date))).utc;
  const jan1 = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.floor((thursday.getTime() - jan1) / 86_400_000 / 7) + 1;
};

/** All days from `from` to `to`, inclusive. */
export const datesBetween = (from: IsoDate, to: IsoDate): IsoDate[] => {
  const dates: IsoDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) dates.push(d);
  return dates;
};
