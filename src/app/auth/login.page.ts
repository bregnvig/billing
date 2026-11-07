import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FirebaseError } from 'firebase/app';
import { AuthService } from './auth.service';

/** Errors that just mean "the user changed their mind": show nothing. */
const CANCELLED = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request']);

const messageFor = (error: unknown): string | null => {
  const code = error instanceof FirebaseError ? error.code : '';
  if (CANCELLED.has(code)) return null;
  if (code === 'auth/popup-blocked')
    return 'The sign-in window was blocked. Allow pop-ups for this site and try again.';
  if (code === 'auth/network-request-failed')
    return "Can't reach the sign-in service. Is the emulator running (npm run emulators)?";
  return 'Sign-in failed. Try again.';
};

@Component({
  selector: 'app-login-page',
  templateUrl: './login.page.html',
})
export class LoginPage {
  readonly #router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly signIn = async (): Promise<void> => {
    this.busy.set(true);
    this.error.set(null);
    try {
      if (await this.auth.signInWithGoogle()) await this.#router.navigateByUrl('/');
    } catch (e) {
      this.error.set(messageFor(e));
    } finally {
      this.busy.set(false);
    }
  };

  protected readonly useAnotherAccount = async (): Promise<void> => {
    await this.auth.signOut();
    await this.signIn();
  };
}
