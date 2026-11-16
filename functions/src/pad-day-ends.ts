import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { addDays, COLLECTIONS, isoDateIn } from '@loopme/model';
import { padDayEnd } from './day-edges';
import { entryFromDoc, entryToDoc } from './firestore';
import { functionOptions } from './options';

/** Used when no hook event has been received yet. */
const DEFAULT_TIME_ZONE = 'Europe/Copenhagen';

/**
 * Nightly, just after midnight: gives the last period of the day that just ended its few extra
 * minutes (see day-edges.ts). The day is local to the time zone of the most recent hook event.
 *
 * Each day is padded at most once: `dayEnds/{date}` records it. The day before is checked too,
 * so a missed run, or a period that was still running at midnight, is picked up the next night.
 */
export const padDayEnds = onSchedule({ ...functionOptions, schedule: '5 0 * * *', timeZone: DEFAULT_TIME_ZONE }, async () => {
  const db = getFirestore();
  const latest = await db.collection(COLLECTIONS.hookEvents).orderBy('at', 'desc').limit(1).get();
  const tz: string = latest.docs[0]?.get('tz') ?? DEFAULT_TIME_ZONE;
  const today = isoDateIn(new Date(), tz);

  for (const date of [addDays(today, -2), addDays(today, -1)]) {
    const markerRef = db.collection(COLLECTIONS.dayEnds).doc(date);
    const result = await db.runTransaction(async tx => {
      if ((await tx.get(markerRef)).exists) return 'already-done';
      const snapshot = await tx.get(db.collection(COLLECTIONS.timeEntries).where('date', '==', date));
      const outcome = padDayEnd(
        snapshot.docs.map(d => entryFromDoc(d.id, d.data())),
        date,
        tz,
        new Date(),
      );
      for (const entry of outcome.writes) tx.set(db.collection(COLLECTIONS.timeEntries).doc(entry.id), entryToDoc(entry));
      // Not while a period is running: it's tried again the next night.
      if (outcome.result !== 'running') tx.set(markerRef, { result: outcome.result, tz, at: FieldValue.serverTimestamp() });
      return outcome.result;
    });
    logger.info('day end', { date, tz, result });
  }
});
