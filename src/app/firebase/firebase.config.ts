import { environment } from '../../environments/environment';

/** The Firebase project for this build: the emulator in development, billing-4e274 in production. */
export const firebaseConfig = environment.firebase;
export const emulators = environment.emulators;

/** Must match the region in functions/src/options.ts. */
export const functionsRegion = 'europe-west1';

/** URL the OS hook posts events to (shown in Settings when adding a device). */
export const reportEventUrl = emulators
  ? `http://${emulators.host}:${emulators.functions}/${firebaseConfig.projectId}/${functionsRegion}/reportEvent`
  : `https://${functionsRegion}-${firebaseConfig.projectId}.cloudfunctions.net/reportEvent`;

/**
 * The only account allowed to use the app. Also in `firestore.rules` and `OWNER_EMAIL` in
 * functions/.env (rules and functions can't import app config), so change all three together.
 */
export const allowedEmail = 'flemming@loopme.dk';
