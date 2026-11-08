import type { Environment } from './environment.model';

/**
 * Development (`ng serve`): the local emulators with a fake `demo-` project, so nothing talks
 * to real Google services. Replaces environment.ts via angular.json `fileReplacements`.
 */
export const environment: Environment = {
  production: false,
  firebase: {
    apiKey: 'fake-api-key',
    authDomain: 'demo-billing.firebaseapp.com',
    projectId: 'demo-billing',
    storageBucket: 'demo-billing.appspot.com',
    messagingSenderId: '000000000000',
    appId: '1:000000000000:web:0000000000000000000000',
  },
  emulators: { host: '127.0.0.1', auth: 9199, firestore: 8180, functions: 5101 },
};
