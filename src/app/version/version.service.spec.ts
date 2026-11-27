import { TestBed } from '@angular/core/testing';
import { NavigationError, provideRouter, Router } from '@angular/router';
import { mainScript, VersionService } from './version.service';

const page = (main: string) =>
  `<!doctype html><html><head></head><body><app-root></app-root><script src="${main}" type="module"></script></body></html>`;

const setup = (running: string | null, live: string | Error) => {
  document.body.querySelectorAll('script[data-test]').forEach(s => s.remove());
  if (running) {
    const script = document.createElement('script');
    script.dataset['test'] = '';
    script.type = 'text/plain'; // don't let jsdom load it
    script.setAttribute('src', running);
    document.body.append(script);
  }
  const fetchMock = vi.fn(async () => {
    if (live instanceof Error) throw live;
    return new Response(page(live));
  });
  vi.stubGlobal('fetch', fetchMock);
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  return { version: TestBed.inject(VersionService), fetchMock };
};

describe('VersionService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('finds the hashed entry script, not the dev one', () => {
    expect(mainScript(page('main-GNBCOOYH.js'))).toBe('main-GNBCOOYH.js');
    expect(mainScript(page('main.js'))).toBeNull();
  });

  it('offers a reload once the live index.html names another entry script, until dismissed', async () => {
    const { version } = setup('main-OLD111.js', 'main-NEW222.js');
    expect(version.updateAvailable()).toBe(false);
    await version.check();
    expect(version.updateAvailable()).toBe(true);
    version.dismiss();
    expect(version.updateAvailable()).toBe(false);
  });

  it('stays quiet when the version is the same', async () => {
    const { version } = setup('main-SAME.js', 'main-SAME.js');
    await version.check();
    expect(version.updateAvailable()).toBe(false);
  });

  it("stays quiet when the server can't be reached", async () => {
    const { version } = setup('main-OLD111.js', new TypeError('Failed to fetch'));
    await version.check();
    expect(version.updateAvailable()).toBe(false);
  });

  it('never checks in a dev build', async () => {
    const { version, fetchMock } = setup('main.js', 'main-NEW222.js');
    await version.check();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(version.updateAvailable()).toBe(false);
  });

  it('offers a reload when a page fails to load because its chunk is gone', () => {
    const { version } = setup('main-OLD111.js', 'main-OLD111.js');
    const router = TestBed.inject(Router);
    (router.events as unknown as { next: (e: unknown) => void }).next(
      new NavigationError(1, '/month', new TypeError('Failed to fetch dynamically imported module: https://x/chunk-ABC.js')),
    );
    expect(version.updateAvailable()).toBe(true);
  });
});
