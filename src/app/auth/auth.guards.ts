import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Lets the app's pages match only for the allowed, signed-in user; otherwise go to /login. */
export const authGuard: CanMatchFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ready();
  return auth.allowed() || router.createUrlTree(['/login']);
};

/** Keeps the allowed user away from /login. */
export const loginGuard: CanMatchFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ready();
  return !auth.allowed() || router.createUrlTree(['/']);
};
