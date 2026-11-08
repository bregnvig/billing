import { Component, inject, signal } from '@angular/core';
import { form, FormField, maxLength, required } from '@angular/forms/signals';
import { reportEventUrl } from '../firebase/firebase.config';
import { formatDateTime } from '../ui/format';
import { DevicesService, NewDevice } from './devices.service';

type Copied = 'token' | 'command' | null;

@Component({
  selector: 'app-settings-page',
  imports: [FormField],
  templateUrl: './settings.page.html',
})
export class SettingsPage {
  readonly #devicesService = inject(DevicesService);
  readonly #model = signal({ name: '' });

  protected readonly devices = this.#devicesService.devices;
  protected readonly loadError = this.#devicesService.error;
  protected readonly formatDateTime = formatDateTime;

  protected readonly deviceForm = form(this.#model, (path) => {
    required(path.name, { message: "Give the device a name, e.g. the computer's hostname." });
    maxLength(path.name, 50, { message: 'Use at most 50 characters.' });
  });

  protected readonly adding = signal(false);
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
      this.actionError.set("Couldn't add the device. Is the emulator running with functions?");
    } finally {
      this.adding.set(false);
    }
  };

  protected readonly copy = async (what: Exclude<Copied, null>, text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(what);
      setTimeout(() => this.copied.update((c) => (c === what ? null : c)), 2000);
    } catch {
      this.actionError.set("Couldn't copy. Select the text and copy it manually.");
    }
  };

  protected readonly revoke = async (deviceId: string): Promise<void> => {
    this.revoking.set(deviceId);
    this.actionError.set(null);
    try {
      await this.#devicesService.revoke(deviceId);
      this.confirmingRevoke.set(null);
    } catch {
      this.actionError.set("Couldn't revoke the device. Try again.");
    } finally {
      this.revoking.set(null);
    }
  };
}
