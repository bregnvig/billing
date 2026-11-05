import { EnvironmentProviders, InjectionToken, makeEnvironmentProviders } from '@angular/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, Firestore, getFirestore } from 'firebase/firestore';
import { emulatorHost, emulatorPorts, firebaseConfig } from './firebase.config';

export const FIREBASE_APP = new InjectionToken<FirebaseApp>('FIREBASE_APP');
export const FIRESTORE = new InjectionToken<Firestore>('FIRESTORE');
export const FIREBASE_AUTH = new InjectionToken<Auth>('FIREBASE_AUTH');

export function provideFirebase(): EnvironmentProviders {
  const app = initializeApp(firebaseConfig);

  const firestore = getFirestore(app);
  connectFirestoreEmulator(firestore, emulatorHost, emulatorPorts.firestore);

  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${emulatorHost}:${emulatorPorts.auth}`, {
    disableWarnings: true,
  });

  return makeEnvironmentProviders([
    { provide: FIREBASE_APP, useValue: app },
    { provide: FIRESTORE, useValue: firestore },
    { provide: FIREBASE_AUTH, useValue: auth },
  ]);
}
