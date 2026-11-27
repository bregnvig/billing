import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { NavigationError, Router } from '@angular/router';

/** The app's hashed entry script (`main-GNBCOOYH.js`) named in an `index.html`. `null` in dev builds (`main.js`). */
export const mainScript = (html: string): string | null => /\bmain-[\w-]+\.js\b/.exec(html)?.[0] ?? null;

/** How often an open, visible tab asks whether a new version is out. */
export const CHECK_INTERVAL_MS = 10 * 60_000;

/** A lazy page that can't load: its chunk is gone, most likely replaced by a deploy. */
const isChunkLoadError = (error: unknown): boolean =>
  /dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(String(error));

/**
 * Notices when a new version is deployed while the app is open, so `ReloadBanner` can offer a
 * reload. Compares the entry script this tab runs with the one the live `index.html` names, when
 * the tab becomes visible again, comes back online, and every 10 minutes while visible. A lazy
 * page failing to load (its chunk removed by a deploy) counts as a new version too.
 * Does nothing in dev builds, whose entry script isn't hashed.
 */
@Injectable({ providedIn: 'root' })
export class VersionService {
  readonly #running = mainScript(document.head.outerHTML + document.body.outerHTML);
  readonly #available = signal(false);
  readonly #dismissed = signal(false);

  /** A newer version is deployed and the banner wasn't closed. */
  readonly updateAvailable = () => this.#available() && !this.#dismissed();

  constructor() {
    inject(Router).events.subscribe(event => {
      if (event instanceof NavigationError && isChunkLoadError(event.error)) this.#available.set(true);
    });
    if (!this.#running) return;
    const onVisible = () => document.visibilityState === 'visible' && void this.check();
    const timer = setInterval(onVisible, CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    });
  }

  /** Asks the server for the live `index.html`. Offline or failing: try again next time. */
  readonly check = async (): Promise<void> => {
    if (!this.#running || this.#available()) return;
    try {
      const response = await fetch('/index.html', { cache: 'no-store' });
      const live = response.ok ? mainScript(await response.text()) : null;
      if (live && live !== this.#running) this.#available.set(true);
    } catch {
      // Offline: checked again when back online.
    }
  };

  /** Hides the banner until the app is reloaded. */
  readonly dismiss = (): void => this.#dismissed.set(true);

  readonly reload = (): void => location.reload();
}
