import { EnvironmentProviders, inject, InjectionToken, makeEnvironmentProviders } from '@angular/core';
import {
  clearIndexedDbPersistence,
  connectFirestoreEmulator,
  Firestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
} from 'firebase/firestore';
import { connectFunctionsEmulator, Functions, getFunctions } from 'firebase/functions';
import { emulators, functionsRegion } from './firebase.config';
import { FIREBASE_APP } from './firebase.providers';

export const FIRESTORE = new InjectionToken<Firestore>('FIRESTORE');
export const FIREBASE_FUNCTIONS = new InjectionToken<Functions>('FIREBASE_FUNCTIONS');

/** One Firestore instance per page load: it may only be initialized (and connected to the emulator) once. */
let firestoreInstance: Firestore | null = null;
let functionsConnected = false;

/**
 * Firestore + Functions, provided on the lazy shell route so their SDKs (≈580 kB) stay out of
 * the initial bundle. Only import this file from lazily loaded code.
 */
export const provideFirebaseData = (): EnvironmentProviders =>
  makeEnvironmentProviders([
    {
      provide: FIRESTORE,
      useFactory: (): Firestore => {
        if (firestoreInstance) return firestoreInstance;
        // Cache in IndexedDB, shared by all tabs: a reload or a revisit fetches only what changed
        // instead of reading every document again (and the app works offline). Cleared on sign-out.
        const firestore = initializeFirestore(inject(FIREBASE_APP), {
          localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
        });
        if (emulators) connectFirestoreEmulator(firestore, emulators.host, emulators.firestore);
        return (firestoreInstance = firestore);
      },
    },
    {
      provide: FIREBASE_FUNCTIONS,
      useFactory: (): Functions => {
        const functions = getFunctions(inject(FIREBASE_APP), functionsRegion);
        if (emulators && !functionsConnected) {
          connectFunctionsEmulator(functions, emulators.host, emulators.functions);
          functionsConnected = true;
        }
        return functions;
      },
    },
  ]);

/**
 * Deletes the local Firestore cache, so no data stays in the browser after signing out. Stops the
 * Firestore instance: reload the page afterwards.
 */
export const clearLocalData = async (firestore: Firestore): Promise<void> => {
  await terminate(firestore);
  await clearIndexedDbPersistence(firestore);
};
