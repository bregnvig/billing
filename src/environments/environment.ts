import type { Environment } from './environment.model';

/**
 * Production: the real Firebase project `billing-4e274`.
 * Firebase web config isn't secret (it identifies the project); access is enforced by
 * firestore.rules and the single allowed account.
 */
export const environment: Environment = {
  production: true,
  firebase: {
    apiKey: 'AIzaSyCtrTwqj5JWHCClQ90Tix4OrIscPl1Eieg',
    authDomain: 'billing-4e274.firebaseapp.com',
    projectId: 'billing-4e274',
    storageBucket: 'billing-4e274.firebasestorage.app',
    messagingSenderId: '1079329898985',
    appId: '1:1079329898985:web:2732ef93fb58c434664b78',
    measurementId: 'G-1CGCFBY0ND',
  },
  emulators: null,
};
