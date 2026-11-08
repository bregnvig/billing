import { DOCUMENT } from '@angular/common';
import { effect, inject, Injectable, signal } from '@angular/core';

export type ThemeSetting = 'light' | 'dark' | 'system';

/** Keep in sync with the inline script in src/index.html. */
const STORAGE_KEY = 'loopme.theme';

const readSetting = (): ThemeSetting => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
};

/** Light / dark / follow-system theme, stored per device and applied as `data-theme` on <html>. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly #root = inject(DOCUMENT).documentElement;
  readonly #setting = signal<ThemeSetting>(readSetting());

  readonly setting = this.#setting.asReadonly();

  constructor() {
    effect(() => this.#apply(this.#setting()));
  }

  readonly set = (setting: ThemeSetting): void => this.#setting.set(setting);

  #apply = (setting: ThemeSetting): void => {
    if (setting === 'system') delete this.#root.dataset['theme'];
    else this.#root.dataset['theme'] = setting;
    try {
      if (setting === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, setting);
    } catch {
      // Storage blocked (private mode etc.): the theme still applies for this session.
    }
  };
}
