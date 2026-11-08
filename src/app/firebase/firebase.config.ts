import { FirebaseOptions } from 'firebase/app';

/**
 * Fake config for the local Firebase emulator. The `demo-` project ID prefix tells the
 * Firebase SDK and CLI that this is a demo project, so nothing talks to real Google services.
 */
export const firebaseConfig: FirebaseOptions = {
  apiKey: 'fake-api-key',
  authDomain: 'demo-billing.firebaseapp.com',
  projectId: 'demo-billing',
  storageBucket: 'demo-billing.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:0000000000000000000000',
};

export const emulatorHost = '127.0.0.1';
export const emulatorPorts = {
  auth: 9199,
  firestore: 8180,
  functions: 5101,
} as const;

/** Must match `setGlobalOptions({ region })` in functions/src/index.ts. */
export const functionsRegion = 'europe-west1';

/** URL the OS hook posts events to (emulator for now). */
export const reportEventUrl = `http://${emulatorHost}:${emulatorPorts.functions}/${firebaseConfig.projectId}/${functionsRegion}/reportEvent`;

/**
 * The only account allowed to use the app. Also hard-coded in `firestore.rules`
 * (rules can't import app config), so change both together.
 */
export const allowedEmail = 'flemming@loopme.dk';
