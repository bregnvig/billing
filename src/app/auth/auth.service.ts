import { computed, inject, Injectable, signal } from '@angular/core';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { allowedEmail } from '../firebase/firebase.config';
import { FIREBASE_AUTH } from '../firebase/firebase.providers';

export const isAllowedUser = (user: Pick<User, 'email' | 'emailVerified'> | null): boolean =>
  !!user && user.emailVerified && user.email?.toLowerCase() === allowedEmail;

/** Google sign-in, restricted to `allowedEmail`. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly #auth = inject(FIREBASE_AUTH);
  readonly #user = signal<User | null>(this.#auth.currentUser);

  /** The Firebase user, allowed or not. */
  readonly user = this.#user.asReadonly();
  /** Signed in with the allowed account. */
  readonly allowed = computed(() => isAllowedUser(this.#user()));

  constructor() {
    onAuthStateChanged(this.#auth, user => this.#user.set(user));
  }

  /** Resolves once Firebase has restored any saved session. */
  readonly ready = (): Promise<void> => this.#auth.authStateReady();

  /** Opens the Google account picker. Resolves `true` if the chosen account is allowed. */
  readonly signInWithGoogle = async (): Promise<boolean> => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const { user } = await signInWithPopup(this.#auth, provider);
    return isAllowedUser(user);
  };

  readonly signOut = (): Promise<void> => signOut(this.#auth);
}
