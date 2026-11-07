import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { authGuard, loginGuard } from './auth.guards';
import { AuthService } from './auth.service';

const run = async (guard: typeof authGuard, allowed: boolean) => {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { ready: async () => {}, allowed: () => allowed } },
    ],
  });
  const result = await TestBed.runInInjectionContext(() =>
    guard({}, [], {} as Parameters<typeof authGuard>[2]),
  );
  const router = TestBed.inject(Router);
  return result instanceof UrlTree ? router.serializeUrl(result) : result;
};

describe('authGuard', () => {
  it('lets the allowed user in', async () => expect(await run(authGuard, true)).toBe(true));
  it('sends everyone else to /login', async () =>
    expect(await run(authGuard, false)).toBe('/login'));
});

describe('loginGuard', () => {
  it('shows /login when not allowed', async () => expect(await run(loginGuard, false)).toBe(true));
  it('sends the allowed user to the app', async () =>
    expect(await run(loginGuard, true)).toBe('/'));
});
