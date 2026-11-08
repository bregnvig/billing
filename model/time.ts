/**
 * Time-zone aware date helpers. Cloud Functions run in UTC and the browser in local time,
 * but a "day" in Loopme is the user's local calendar day, so these take an IANA time zone.
 */

import type { IsoDate } from './entities';

export const isValidTimeZone = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const partsIn = (at: Date, tz: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
};

/** The local calendar day of `at` in `tz`. */
export const isoDateIn = (at: Date, tz: string): IsoDate => {
  const { year, month, day } = partsIn(at, tz);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
};

/** Offset of `tz` from UTC at instant `at`, in milliseconds (e.g. +1h for Copenhagen in winter). */
const offsetMs = (at: Date, tz: string): number => {
  const p = partsIn(at, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
};

/** The instant local midnight starts `date` in `tz` (DST-safe). */
export const startOfDayIn = (date: IsoDate, tz: string): Date => {
  const [y, m, d] = date.split('-').map(Number);
  const wallClock = Date.UTC(y, m - 1, d);
  // Two passes settle the offset even when midnight is near a DST switch.
  let guess = wallClock - offsetMs(new Date(wallClock), tz);
  guess = wallClock - offsetMs(new Date(guess), tz);
  return new Date(guess);
};

/** `date` plus `days` calendar days. */
export const addDays = (date: IsoDate, days: number): IsoDate => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10) as IsoDate;
};
