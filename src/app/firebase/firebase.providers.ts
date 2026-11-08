import { EnvironmentProviders, InjectionToken, makeEnvironmentProviders } from '@angular/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, connectAuthEmulator, getAuth } from 'firebase/auth';
import { emulators, firebaseConfig } from './firebase.config';

export const FIREBASE_APP = new InjectionToken<FirebaseApp>('FIREBASE_APP');
export const FIREBASE_AUTH = new InjectionToken<Auth>('FIREBASE_AUTH');

/**
 * Startup providers: only the Firebase app and Auth (the route guards need Auth right away).
 * Firestore and Functions are much bigger and only needed after sign-in, so they're provided on
 * the lazy shell route instead (see firebase-data.providers.ts and shell/shell.routes.ts).
 * Don't import firebase/firestore or firebase/functions from here: it would pull them into main.
 */
export const provideFirebase = (): EnvironmentProviders => {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  if (emulators) connectAuthEmulator(auth, `http://${emulators.host}:${emulators.auth}`, { disableWarnings: true });

  return makeEnvironmentProviders([
    { provide: FIREBASE_APP, useValue: app },
    { provide: FIREBASE_AUTH, useValue: auth },
  ]);
};
