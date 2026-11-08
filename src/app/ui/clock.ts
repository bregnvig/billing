import { DestroyRef, inject, signal, Signal } from '@angular/core';

/**
 * The current time as a signal, updated every `intervalMs` (default 30s, enough for minute
 * resolution). Call in an injection context; the timer stops with the owner.
 */
export const injectNow = (intervalMs = 30_000): Signal<Date> => {
  const now = signal(new Date());
  const timer = setInterval(() => now.set(new Date()), intervalMs);
  inject(DestroyRef).onDestroy(() => clearInterval(timer));
  return now.asReadonly();
};
