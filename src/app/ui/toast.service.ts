import { Injectable, signal } from '@angular/core';

export interface Toast {
  /** Translation key and params. */
  message: string;
  params?: Record<string, unknown>;
  /** Optional action, e.g. Undo. */
  actionLabel?: string;
  action?: () => unknown;
}

/** One toast at a time, bottom-centre, auto-hiding after 6 seconds (ui-design skill). */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly #current = signal<Toast | null>(null);
  #timer: ReturnType<typeof setTimeout> | undefined;

  readonly current = this.#current.asReadonly();

  readonly show = (toast: Toast, ms = 6000): void => {
    clearTimeout(this.#timer);
    this.#current.set(toast);
    this.#timer = setTimeout(() => this.#current.set(null), ms);
  };

  readonly dismiss = (): void => {
    clearTimeout(this.#timer);
    this.#current.set(null);
  };

  readonly runAction = async (): Promise<void> => {
    const action = this.#current()?.action;
    this.dismiss();
    await action?.();
  };
}
