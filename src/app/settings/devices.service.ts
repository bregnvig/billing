import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { Device } from '@loopme/model';
import { onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { devicesCollection } from '../data/collections';
import { FIREBASE_FUNCTIONS, FIRESTORE } from '../firebase/firebase-data.providers';

export interface NewDevice {
  deviceId: string;
  /** Shown once; only its hash is stored. */
  token: string;
}

/** Devices allowed to report OS hook events. Writes go through Cloud Functions.
 * Provided on the lazy shell route (it needs FIRESTORE, which only exists there).
 */
@Injectable()
export class DevicesService {
  readonly #functions = inject(FIREBASE_FUNCTIONS);
  readonly #devices = signal<Device[] | null>(null);
  readonly #error = signal<string | null>(null);

  /** `null` while loading. */
  readonly devices = this.#devices.asReadonly();
  /** Translation key. */
  readonly error = this.#error.asReadonly();

  constructor() {
    const unsubscribe = onSnapshot(
      query(devicesCollection(inject(FIRESTORE)), orderBy('createdAt', 'desc')),
      snapshot => {
        this.#devices.set(snapshot.docs.map(d => d.data()));
        this.#error.set(null);
      },
      () => this.#error.set('settings.devices.errors.load'),
    );
    inject(DestroyRef).onDestroy(unsubscribe);
  }

  readonly create = async (name: string): Promise<NewDevice> =>
    (await httpsCallable<{ name: string }, NewDevice>(this.#functions, 'createDevice')({ name })).data;

  readonly revoke = async (deviceId: string): Promise<void> => {
    await httpsCallable<{ deviceId: string }, { ok: true }>(
      this.#functions,
      'revokeDevice',
    )({
      deviceId,
    });
  };
}
