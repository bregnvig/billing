import { TestBed } from '@angular/core/testing';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { VersionService } from './version.service';

const setup = (isEnabled = true) => {
  const versionUpdates = new Subject<VersionEvent>();
  const unrecoverable = new Subject<{ type: 'UNRECOVERABLE_STATE'; reason: string }>();
  const checkForUpdate = vi.fn(async () => true);
  TestBed.configureTestingModule({
    providers: [{ provide: SwUpdate, useValue: { isEnabled, versionUpdates, unrecoverable, checkForUpdate } }],
  });
  return { version: TestBed.inject(VersionService), versionUpdates, unrecoverable, checkForUpdate };
};

const ready = { type: 'VERSION_READY', currentVersion: { hash: 'a' }, latestVersion: { hash: 'b' } } as VersionEvent;

describe('VersionService', () => {
  it('offers a reload once a new version is ready, until dismissed', () => {
    const { version, versionUpdates } = setup();
    versionUpdates.next({ type: 'VERSION_DETECTED', version: { hash: 'b' } });
    expect(version.reloadReason()).toBeNull();
    versionUpdates.next(ready);
    expect(version.reloadReason()).toBe('update');
    version.dismiss();
    expect(version.reloadReason()).toBeNull();
  });

  it('insists on a reload when the cached version is broken, even after dismissing', () => {
    const { version, unrecoverable } = setup();
    version.dismiss();
    unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'gone' });
    expect(version.reloadReason()).toBe('broken');
  });

  it('checks for a new version when the tab becomes visible, and survives being offline', async () => {
    const { checkForUpdate } = setup();
    checkForUpdate.mockRejectedValueOnce(new Error('offline'));
    document.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    expect(checkForUpdate).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('online'));
    expect(checkForUpdate).toHaveBeenCalledTimes(2);
  });

  it('does nothing without a service worker', async () => {
    const { version, checkForUpdate } = setup(false);
    await version.check();
    expect(checkForUpdate).not.toHaveBeenCalled();
    expect(version.reloadReason()).toBeNull();
  });
});
