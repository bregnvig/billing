import { Component, inject, signal } from '@angular/core';
import { form, FormField, maxLength, required } from '@angular/forms/signals';
import { TranslatePipe } from '@ngx-translate/core';
import { reportEventUrl } from '../firebase/firebase.config';
import { LANGUAGES, LanguageService } from '../i18n/language.service';
import { formatDateTime } from '../ui/format';
import { ThemeService, ThemeSetting } from '../ui/theme.service';
import { DevicesService, NewDevice } from './devices.service';

type Copied = 'token' | 'command' | null;

@Component({
  selector: 'app-settings-page',
  imports: [FormField, TranslatePipe],
  templateUrl: './settings.page.html',
})
export class SettingsPage {
  readonly #devicesService = inject(DevicesService);
  readonly #model = signal({ name: '' });

  protected readonly devices = this.#devicesService.devices;
  protected readonly loadError = this.#devicesService.error;
  protected readonly theme = inject(ThemeService);
  protected readonly language = inject(LanguageService);
  protected readonly languages = LANGUAGES;
  protected readonly themes: readonly { value: ThemeSetting; icon: string }[] = [
    { value: 'system', icon: 'brightness_auto' },
    { value: 'light', icon: 'light_mode' },
    { value: 'dark', icon: 'dark_mode' },
  ];
  protected readonly formatDateTime = (d: Date) => formatDateTime(d, this.language.locale());

  protected readonly deviceForm = form(this.#model, path => {
    required(path.name, { message: 'settings.devices.nameRequired' });
    maxLength(path.name, 50, { message: 'settings.devices.nameTooLong' });
  });

  protected readonly adding = signal(false);
  /** Translation key. */
  protected readonly actionError = signal<string | null>(null);
  protected readonly created = signal<(NewDevice & { name: string }) | null>(null);
  protected readonly copied = signal<Copied>(null);
  protected readonly confirmingRevoke = signal<string | null>(null);
  protected readonly revoking = signal<string | null>(null);

  protected readonly installCommand = `./hooks/install.sh --url ${reportEventUrl}`;

  protected readonly addDevice = async (event: Event): Promise<void> => {
    event.preventDefault();
    this.deviceForm.name().markAsTouched();
    if (!this.deviceForm().valid() || this.adding()) return;
    this.adding.set(true);
    this.actionError.set(null);
    try {
      const name = this.#model().name.trim();
      this.created.set({ ...(await this.#devicesService.create(name)), name });
      this.#model.set({ name: '' });
      this.deviceForm().reset();
    } catch {
      this.actionError.set('settings.devices.errors.add');
    } finally {
      this.adding.set(false);
    }
  };

  protected readonly copy = async (what: Exclude<Copied, null>, text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(what);
      setTimeout(() => this.copied.update(c => (c === what ? null : c)), 2000);
    } catch {
      this.actionError.set('settings.devices.errors.copy');
    }
  };

  protected readonly revoke = async (deviceId: string): Promise<void> => {
    this.revoking.set(deviceId);
    this.actionError.set(null);
    try {
      await this.#devicesService.revoke(deviceId);
      this.confirmingRevoke.set(null);
    } catch {
      this.actionError.set('settings.devices.errors.revoke');
    } finally {
      this.revoking.set(null);
    }
  };
}
