import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FirebaseError } from 'firebase/app';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from './auth.service';

/** Errors that just mean "the user changed their mind": show nothing. */
const CANCELLED = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request']);

/** Translation key for a sign-in error, or `null` to show nothing. */
const messageKeyFor = (error: unknown): string | null => {
  const code = error instanceof FirebaseError ? error.code : '';
  if (CANCELLED.has(code)) return null;
  if (code === 'auth/popup-blocked') return 'login.errors.popupBlocked';
  if (code === 'auth/network-request-failed') return 'login.errors.network';
  return 'login.errors.failed';
};

@Component({
  selector: 'app-login-page',
  imports: [TranslatePipe],
  templateUrl: './login.page.html',
})
export class LoginPage {
  readonly #router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly busy = signal(false);
  /** Translation key. */
  protected readonly error = signal<string | null>(null);

  protected readonly signIn = async (): Promise<void> => {
    this.busy.set(true);
    this.error.set(null);
    try {
      if (await this.auth.signInWithGoogle()) await this.#router.navigateByUrl('/');
    } catch (e) {
      this.error.set(messageKeyFor(e));
    } finally {
      this.busy.set(false);
    }
  };

  protected readonly useAnotherAccount = async (): Promise<void> => {
    await this.auth.signOut();
    await this.signIn();
  };
}
