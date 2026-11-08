import type { FirebaseOptions } from 'firebase/app';

export interface Environment {
  production: boolean;
  /** `measurementId` enables Google Analytics, loaded only after cookie consent. */
  firebase: FirebaseOptions & { projectId: string };
  /** Local emulator ports, or `null` to use the real Firebase project. Keep in sync with firebase.json. */
  emulators: { host: string; auth: number; firestore: number; functions: number } | null;
}
