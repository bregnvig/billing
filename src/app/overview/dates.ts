import { IsoDate } from '@loopme/model';

/** Local midnight of an IsoDate. */
export const dayStart = (date: IsoDate): Date => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Same wall-clock time `days` days earlier/later (DST-safe). */
export const shiftDays = (t: Date, days: number): Date =>
  new Date(t.getFullYear(), t.getMonth(), t.getDate() + days, t.getHours(), t.getMinutes(), t.getSeconds());
