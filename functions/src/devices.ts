import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { COLLECTIONS } from '@loopme/model';
import { functionOptions } from './options';
import { assertOwner } from './owner';
import { hashToken, newDeviceToken, parseDeviceName } from './validate';

/**
 * Registers a device for the OS hook and returns its token. The token is shown once:
 * only its SHA-256 hash is stored, in `deviceTokens` (which no client can read).
 */
export const createDevice = onCall(functionOptions, async request => {
  assertOwner(request);
  const name = parseDeviceName(request.data?.name);
  if (!name.ok) throw new HttpsError('invalid-argument', name.error);

  const db = getFirestore();
  const token = newDeviceToken();
  const deviceRef = db.collection(COLLECTIONS.devices).doc();
  const batch = db.batch();
  batch.set(deviceRef, {
    name: name.value,
    createdAt: FieldValue.serverTimestamp(),
    lastSeenAt: null,
    revokedAt: null,
  });
  batch.set(db.collection(COLLECTIONS.deviceTokens).doc(hashToken(token)), {
    deviceId: deviceRef.id,
    createdAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
  return { deviceId: deviceRef.id, token };
});

/** Revokes a device: its token stops working immediately. */
export const revokeDevice = onCall(functionOptions, async request => {
  assertOwner(request);
  const deviceId = request.data?.deviceId;
  if (typeof deviceId !== 'string' || !/^[A-Za-z0-9]{1,40}$/.test(deviceId)) {
    throw new HttpsError('invalid-argument', 'deviceId is required.');
  }

  const db = getFirestore();
  const deviceRef = db.collection(COLLECTIONS.devices).doc(deviceId);
  if (!(await deviceRef.get()).exists) throw new HttpsError('not-found', 'No such device.');

  const tokens = await db.collection(COLLECTIONS.deviceTokens).where('deviceId', '==', deviceId).get();
  const batch = db.batch();
  for (const doc of tokens.docs) batch.delete(doc.ref);
  batch.update(deviceRef, { revokedAt: FieldValue.serverTimestamp() });
  await batch.commit();
  return { ok: true };
});
