import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onRequest } from 'firebase-functions/v2/https';
import { addDays, COLLECTIONS, HookEventResult, isoDateIn } from '@loopme/model';
import { applyEvent, LOOKBACK_DAYS } from './events';
import { functionOptions } from './options';
import { entryFromDoc, entryToDoc } from './firestore';
import { bearerToken, hashToken, parseReportBody } from './validate';

/**
 * Receives start/stop events from an OS hook (see hooks/loopme-hook).
 *
 * Auth: `Authorization: Bearer <device token>`. Only the token's SHA-256 hash is stored
 * (`deviceTokens/{hash}`), and revoking the device in the web app deletes it.
 * Idempotent: each `eventId` is recorded in `hookEvents`, so retries from the hook's
 * offline queue never create duplicate periods.
 */
export const reportEvent = onRequest({ ...functionOptions, cors: false }, async (req, res) => {
  if (req.method !== 'POST') {
    res.set('Allow', 'POST').status(405).json({ error: 'Use POST.' });
    return;
  }

  const token = bearerToken(req.get('authorization'));
  const db = getFirestore();
  const tokenDoc = token ? await db.collection(COLLECTIONS.deviceTokens).doc(hashToken(token)).get() : null;
  const deviceId: string | undefined = tokenDoc?.get('deviceId');
  const deviceRef = deviceId ? db.collection(COLLECTIONS.devices).doc(deviceId) : null;
  const device = deviceRef ? await deviceRef.get() : null;
  if (!deviceRef || !device?.exists || device.get('revokedAt')) {
    res.status(401).json({ error: 'Unknown or revoked device token.' });
    return;
  }

  const now = new Date();
  const parsed = parseReportBody(req.body, now);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const seen = deviceRef.update({ lastSeenAt: FieldValue.serverTimestamp() });
  const body = parsed.value;
  if (body.type === 'ping') {
    await seen;
    res.json({ ok: true, device: device.get('name') });
    return;
  }

  const event = body;
  const today = isoDateIn(event.at, event.tz);
  const eventRef = db.collection(COLLECTIONS.hookEvents).doc(event.eventId);

  const result = await db.runTransaction(async (tx): Promise<HookEventResult> => {
    const previous = await tx.get(eventRef);
    if (previous.exists) return 'duplicate';

    const snapshot = await tx.get(
      db.collection(COLLECTIONS.timeEntries).where('date', '>=', addDays(today, -LOOKBACK_DAYS)).where('date', '<=', today),
    );
    const entries = snapshot.docs.map(d => entryFromDoc(d.id, d.data()));
    const outcome = applyEvent(entries, event, now);

    for (const entry of outcome.writes) tx.set(db.collection(COLLECTIONS.timeEntries).doc(entry.id), entryToDoc(entry));
    tx.set(eventRef, {
      deviceId,
      type: event.type,
      reason: event.reason,
      at: event.at,
      tz: event.tz,
      result: outcome.result,
      receivedAt: FieldValue.serverTimestamp(),
    });
    return outcome.result;
  });

  await seen;
  logger.info('hook event', {
    deviceId,
    eventId: event.eventId,
    type: event.type,
    reason: event.reason,
    result,
  });
  res.json({ result });
});
