import { createHash, randomBytes } from 'node:crypto';
import { HOOK_EVENT_REASONS, HookEvent, HookEventReason, isValidTimeZone } from '@loopme/model';

/** Events older than this are refused (the hook's offline queue should never get that old). */
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** Allowed clock skew for events "from the future". */
export const MAX_SKEW_MS = 5 * 60 * 1000;

const EVENT_ID = /^[A-Za-z0-9-]{8,64}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const ALLOWED_KEYS = new Set(['eventId', 'type', 'at', 'tz', 'reason']);

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** A `ping` checks the token without recording anything (used by the installer). */
export type ReportBody = { type: 'ping' } | HookEvent;

/** Strictly validates the request body from the OS hook. */
export const parseReportBody = (body: unknown, now: Date): Parsed<ReportBody> => {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'Body must be a JSON object.' };
  }
  const b = body as Record<string, unknown>;
  if (b['type'] === 'ping' && Object.keys(b).length === 1) return { ok: true, value: { type: 'ping' } };

  const unknownKeys = Object.keys(b).filter(k => !ALLOWED_KEYS.has(k));
  if (unknownKeys.length) return { ok: false, error: `Unknown fields: ${unknownKeys.join(', ')}.` };

  const { eventId, type, at, tz, reason } = b;
  if (typeof eventId !== 'string' || !EVENT_ID.test(eventId)) {
    return { ok: false, error: 'eventId must be 8-64 letters, digits or dashes.' };
  }
  if (type !== 'start' && type !== 'stop') return { ok: false, error: "type must be 'start' or 'stop'." };
  if (typeof at !== 'string' || !ISO_INSTANT.test(at) || Number.isNaN(Date.parse(at))) {
    return { ok: false, error: 'at must be a UTC ISO timestamp like 2026-11-05T08:02:00.000Z.' };
  }
  if (typeof tz !== 'string' || tz.length > 64 || !isValidTimeZone(tz)) {
    return { ok: false, error: 'tz must be an IANA time zone like Europe/Copenhagen.' };
  }
  if (typeof reason !== 'string' || !(HOOK_EVENT_REASONS as readonly string[]).includes(reason)) {
    return { ok: false, error: `reason must be one of: ${HOOK_EVENT_REASONS.join(', ')}.` };
  }

  const atDate = new Date(at);
  if (atDate.getTime() > now.getTime() + MAX_SKEW_MS) {
    return { ok: false, error: 'at is in the future. Check the device clock.' };
  }
  if (atDate.getTime() < now.getTime() - MAX_AGE_MS) {
    return { ok: false, error: 'at is more than 7 days old.' };
  }

  return { ok: true, value: { eventId, type, at: atDate, tz, reason: reason as HookEventReason } };
};

/** Extracts the token from `Authorization: Bearer <token>`. */
export const bearerToken = (header: string | undefined): string | null => {
  const match = /^Bearer ([A-Za-z0-9_-]{20,200})$/.exec(header ?? '');
  return match ? match[1] : null;
};

/** Device tokens are only ever stored as this hash. */
export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

/** A new device token, prefixed so it's recognisable if it leaks (e.g. in a paste). */
export const newDeviceToken = (): string => `lpm_${randomBytes(32).toString('base64url')}`;

export const parseDeviceName = (name: unknown): Parsed<string> => {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  return trimmed.length >= 1 && trimmed.length <= 50
    ? { ok: true, value: trimmed }
    : { ok: false, error: 'Device name must be 1-50 characters.' };
};
