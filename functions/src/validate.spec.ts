import { describe, expect, it } from 'vitest';
import { bearerToken, hashToken, newDeviceToken, parseDeviceName, parseReportBody } from './validate';

const now = new Date('2026-11-05T12:00:00.000Z');
const valid = {
  eventId: '4f9c2a1e-7b3d-4c8e-9a1f-2b3c4d5e6f70',
  type: 'start',
  at: '2026-11-05T08:02:00.000Z',
  tz: 'Europe/Copenhagen',
  reason: 'unlock',
};

describe('parseReportBody', () => {
  it('accepts a valid event and a ping', () => {
    const parsed = parseReportBody(valid, now);
    expect(parsed.ok && parsed.value).toMatchObject({ type: 'start', at: new Date(valid.at) });
    expect(parseReportBody({ type: 'ping' }, now)).toEqual({ ok: true, value: { type: 'ping' } });
  });

  it.each([
    ['not an object', 'nope'],
    ['an array', [valid]],
    ['unknown fields', { ...valid, projectId: 'acme' }],
    ['a short eventId', { ...valid, eventId: 'abc' }],
    ['an eventId with odd characters', { ...valid, eventId: '../../etc/passwd' }],
    ['an unknown type', { ...valid, type: 'pause' }],
    ['a non-UTC timestamp', { ...valid, at: '2026-11-05T09:02:00+01:00' }],
    ['an invalid date', { ...valid, at: '2026-13-45T08:02:00Z' }],
    ['an unknown time zone', { ...valid, tz: 'Mars/Olympus' }],
    ['an unknown reason', { ...valid, reason: 'coffee' }],
    ['a time far in the future', { ...valid, at: '2026-11-05T12:10:00.000Z' }],
    ['a time older than 7 days', { ...valid, at: '2026-10-28T11:59:00.000Z' }],
    ['ping with extra fields', { type: 'ping', eventId: valid.eventId }],
  ])('refuses %s', (_label, body) => {
    expect(parseReportBody(body, now).ok).toBe(false);
  });
});

describe('tokens', () => {
  it('reads only well-formed bearer tokens', () => {
    const token = newDeviceToken();
    expect(bearerToken(`Bearer ${token}`)).toBe(token);
    expect(bearerToken(token)).toBeNull();
    expect(bearerToken('Bearer short')).toBeNull();
    expect(bearerToken(undefined)).toBeNull();
  });

  it('creates unique, prefixed tokens and hashes them deterministically', () => {
    const a = newDeviceToken();
    expect(a).toMatch(/^lpm_[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(newDeviceToken());
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('parseDeviceName', () => {
  it('trims and limits the name', () => {
    expect(parseDeviceName('  omarchy-laptop ')).toEqual({ ok: true, value: 'omarchy-laptop' });
    expect(parseDeviceName('').ok).toBe(false);
    expect(parseDeviceName('x'.repeat(51)).ok).toBe(false);
    expect(parseDeviceName(42).ok).toBe(false);
  });
});
