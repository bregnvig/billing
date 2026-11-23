import { defineString } from 'firebase-functions/params';
import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';

/** Set in functions/.env. Keep in sync with firestore.rules and the web app config. */
const ownerEmail = defineString('OWNER_EMAIL');

/** Callable functions are for the owner's verified account only. */
export const assertOwner = (request: CallableRequest): void => {
  const token = request.auth?.token;
  if (!token || token.email?.toLowerCase() !== ownerEmail.value() || token.email_verified !== true) {
    throw new HttpsError('permission-denied', 'Only the owner can do this.');
  }
};
