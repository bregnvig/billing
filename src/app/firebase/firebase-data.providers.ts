import { EnvironmentProviders, inject, InjectionToken, makeEnvironmentProviders } from '@angular/core';
import { connectFirestoreEmulator, Firestore, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, Functions, getFunctions } from 'firebase/functions';
import { emulators, functionsRegion } from './firebase.config';
import { FIREBASE_APP } from './firebase.providers';

export const FIRESTORE = new InjectionToken<Firestore>('FIRESTORE');
export const FIREBASE_FUNCTIONS = new InjectionToken<Functions>('FIREBASE_FUNCTIONS');

/** Emulators may only be connected once per instance, even if the route injector is re-created. */
let firestoreConnected = false;
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
        const firestore = getFirestore(inject(FIREBASE_APP));
        if (emulators && !firestoreConnected) {
          connectFirestoreEmulator(firestore, emulators.host, emulators.firestore);
          firestoreConnected = true;
        }
        return firestore;
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
