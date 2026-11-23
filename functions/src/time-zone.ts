import { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@loopme/model';

/** Used when no hook event has been received yet. */
export const DEFAULT_TIME_ZONE = 'Europe/Copenhagen';

/** The time zone of the most recent hook event: where "a day" is for the scheduled functions. */
export const latestTimeZone = async (db: Firestore): Promise<string> => {
  const latest = await db.collection(COLLECTIONS.hookEvents).orderBy('at', 'desc').limit(1).get();
  return latest.docs[0]?.get('tz') ?? DEFAULT_TIME_ZONE;
};
