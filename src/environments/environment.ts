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
    // Our own domain, so the Google sign-in popup runs first-party (needs the domain in Auth "Authorized domains"
    // and https://billing.loopme.dk/__/auth/handler as a redirect URI on the OAuth web client).
    authDomain: 'billing.loopme.dk',
    projectId: 'billing-4e274',
    storageBucket: 'billing-4e274.firebasestorage.app',
    messagingSenderId: '1079329898985',
    appId: '1:1079329898985:web:2732ef93fb58c434664b78',
    measurementId: 'G-1CGCFBY0ND',
  },
  emulators: null,
};
