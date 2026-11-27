import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

/** How often an open, visible tab asks the service worker to look for a new version. */
export const CHECK_INTERVAL_MS = 10 * 60_000;

/** Why the app should be reloaded. */
export type ReloadReason = 'update' | 'broken';

/**
 * Tells `ReloadBanner` when to offer a reload, from the Angular service worker (`SwUpdate`):
 * - `update`: a new version is deployed and downloaded (`VERSION_READY`); reloading switches to it.
 * - `broken`: the cached version can't be served any more (`unrecoverable`); only a reload helps.
 * Besides the service worker's own checks (on start and navigation), it checks when the tab
 * becomes visible, comes back online, and every 10 minutes while visible.
 * Does nothing without a service worker (dev builds, tests, unsupported browsers).
 */
@Injectable({ providedIn: 'root' })
export class VersionService {
  readonly #sw = inject(SwUpdate);
  readonly #reason = signal<ReloadReason | null>(null);
  readonly #dismissed = signal(false);

  /** Why to reload, unless the banner was closed ("broken" can't be closed). */
  readonly reloadReason = (): ReloadReason | null => (this.#reason() === 'update' && this.#dismissed() ? null : this.#reason());

  constructor() {
    if (!this.#sw.isEnabled) return;
    const subscriptions = [
      this.#sw.versionUpdates.subscribe(event => {
        if (event.type === 'VERSION_READY' && this.#reason() === null) this.#reason.set('update');
      }),
      this.#sw.unrecoverable.subscribe(() => this.#reason.set('broken')),
    ];
    const onVisible = () => document.visibilityState === 'visible' && void this.check();
    const timer = setInterval(onVisible, CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    inject(DestroyRef).onDestroy(() => {
      subscriptions.forEach(s => s.unsubscribe());
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    });
  }

  /** Asks the service worker to look for a new version. Offline or failing: tried again next time. */
  readonly check = async (): Promise<void> => {
    if (!this.#sw.isEnabled || this.#reason()) return;
    try {
      await this.#sw.checkForUpdate();
    } catch {
      // Offline: checked again when back online.
    }
  };

  /** Hides the banner until the app is reloaded. */
  readonly dismiss = (): void => this.#dismissed.set(true);

  /** Reloading loads the newest version the service worker has. */
  readonly reload = (): void => location.reload();
}
