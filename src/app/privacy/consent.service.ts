import { DOCUMENT } from '@angular/common';
import { effect, inject, Injectable, signal } from '@angular/core';
import { FIREBASE_APP } from '../firebase/firebase.providers';
import { firebaseConfig } from '../firebase/firebase.config';

export type Consent = 'granted' | 'denied';

/** Keep in sync with the privacy text. Bump the version when what we collect changes. */
const STORAGE_KEY = 'loopme.consent';
const VERSION = 1;

interface StoredConsent {
  analytics: Consent;
  version: number;
  at: string;
}

const readStored = (): Consent | null => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as StoredConsent | null;
    return stored?.version === VERSION && (stored.analytics === 'granted' || stored.analytics === 'denied') ? stored.analytics : null;
  } catch {
    return null;
  }
};

/**
 * Cookie consent for Google Analytics (via Firebase). Nothing analytics-related is downloaded or
 * set before consent: the SDK is imported lazily on "granted". Withdrawing stops collection and
 * deletes the `_ga` cookies. Necessary storage (theme, language, sign-in) needs no consent.
 */
@Injectable({ providedIn: 'root' })
export class ConsentService {
  readonly #app = inject(FIREBASE_APP);
  readonly #document = inject(DOCUMENT);
  readonly #choice = signal<Consent | null>(readStored());
  #analyticsLoaded = false;

  /** `null` until the user has chosen (then the banner shows). */
  readonly choice = this.#choice.asReadonly();
  /** Analytics only exists in builds with a measurement ID (production). */
  readonly analyticsAvailable = !!firebaseConfig.measurementId;

  constructor() {
    effect(() => {
      const choice = this.#choice();
      if (choice === 'granted') void this.#startAnalytics();
      if (choice === 'denied') void this.#stopAnalytics();
    });
  }

  readonly set = (analytics: Consent): void => {
    this.#choice.set(analytics);
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ analytics, version: VERSION, at: new Date().toISOString() } satisfies StoredConsent),
      );
    } catch {
      // Storage blocked: the choice applies for this session; the banner returns next time.
    }
  };

  #startAnalytics = async (): Promise<void> => {
    if (!this.analyticsAvailable) return;
    const analytics = await import('firebase/analytics');
    if (!(await analytics.isSupported())) return;
    if (!this.#analyticsLoaded) {
      analytics.initializeAnalytics(this.#app);
      this.#analyticsLoaded = true;
    }
    analytics.setAnalyticsCollectionEnabled(analytics.getAnalytics(this.#app), true);
  };

  #stopAnalytics = async (): Promise<void> => {
    if (this.#analyticsLoaded) {
      const analytics = await import('firebase/analytics');
      analytics.setAnalyticsCollectionEnabled(analytics.getAnalytics(this.#app), false);
    }
    this.#deleteAnalyticsCookies();
  };

  /** Removes Google Analytics cookies (`_ga`, `_ga_<id>`, `_gid`) on this host and its parent domains. */
  #deleteAnalyticsCookies = (): void => {
    const names = this.#document.cookie
      .split(';')
      .map(c => c.split('=')[0].trim())
      .filter(n => n === '_ga' || n.startsWith('_ga_') || n === '_gid');
    const parts = this.#document.location.hostname.split('.');
    const domains = ['', ...parts.map((_, i) => '.' + parts.slice(i).join('.'))];
    for (const name of names) {
      for (const domain of domains) {
        this.#document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ''}`;
      }
    }
  };
}
