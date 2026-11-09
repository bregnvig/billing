import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { provideTestTranslations, useEnglish } from '../testing/translations';
import { Shell } from './shell';

describe('Shell', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Shell],
      providers: [
        provideRouter(['overview', 'week', 'projects', 'settings'].map(path => ({ path, children: [] }))),
        provideTestTranslations(),
        {
          provide: AuthService,
          useValue: { user: signal({ email: 'flemming@loopme.dk' }), signOut: async () => {} },
        },
      ],
    }).compileComponents();
    useEnglish();
  });

  it('renders the translated rail with navigation and sign-out, but no theme toggle', async () => {
    const fixture = TestBed.createComponent(Shell);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('nav[aria-label="Main"] a[aria-label="Overview"]')).toBeTruthy();
    expect(el.querySelector('a[aria-label="Settings"]')).toBeTruthy();
    expect(el.querySelector('button[aria-label="Sign out flemming@loopme.dk"]')).toBeTruthy();
    expect(el.querySelector('button[aria-label^="Theme"]')).toBeNull();
  });

  it('marks the current page in the rail and in the drawer', async () => {
    const fixture = TestBed.createComponent(Shell);
    await TestBed.inject(Router).navigateByUrl('/week');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const railWeek = el.querySelector<HTMLElement>('nav[aria-label="Main"] a[aria-label="Week"]')!;
    expect(railWeek.classList).toContain('bg-accent-soft');
    expect(railWeek.classList).toContain('size-10');
    expect(railWeek.getAttribute('aria-current')).toBe('page');

    el.querySelector<HTMLButtonElement>('button[aria-label="Open menu"]')!.click();
    await fixture.whenStable();
    const drawerLinks = [...el.querySelectorAll<HTMLAnchorElement>('#menu-drawer nav a')];
    // textContent also holds the icon's ligature name (e.g. 'dashboard'), so match the end.
    expect(drawerLinks.map(a => a.textContent?.trim())).toEqual(
      ['Overview', 'Week', 'Projects', 'Settings'].map(l => expect.stringMatching(new RegExp(`${l}$`))),
    );
    const drawerWeek = drawerLinks[1];
    expect(drawerWeek.classList).toContain('bg-accent-soft');
    expect(drawerWeek.classList).toContain('h-12');
    expect(drawerWeek.getAttribute('aria-current')).toBe('page');
    expect(drawerWeek.hasAttribute('aria-label')).toBe(false);
  });

  describe('phone menu', () => {
    const setup = async () => {
      const fixture = TestBed.createComponent(Shell);
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;
      const menuButton = el.querySelector<HTMLButtonElement>('button[aria-label="Open menu"]')!;
      const open = async () => {
        menuButton.click();
        await fixture.whenStable();
      };
      const drawer = () => el.querySelector<HTMLElement>('#menu-drawer');
      return { fixture, el, menuButton, open, drawer };
    };

    it('opens the drawer as a modal over an inert page', async () => {
      const { el, menuButton, open, drawer } = await setup();
      expect(drawer()).toBeNull();
      expect(menuButton.getAttribute('aria-expanded')).toBe('false');

      await open();
      expect(drawer()?.getAttribute('role')).toBe('dialog');
      expect(drawer()?.getAttribute('aria-modal')).toBe('true');
      expect(menuButton.getAttribute('aria-expanded')).toBe('true');
      expect(drawer()?.textContent).toContain('Overview');
      expect(drawer()?.textContent).toContain('Sign out');
      expect((el.querySelector('main') as HTMLElement).inert).toBe(true);
    });

    it('closes on Escape, the close button, the backdrop and picking a page', async () => {
      const { fixture, el, open, drawer } = await setup();
      const closeWith = async (act: () => void) => {
        await open();
        expect(drawer()).toBeTruthy();
        act();
        await fixture.whenStable();
        expect(drawer()).toBeNull();
        expect((el.querySelector('main') as HTMLElement).inert).toBe(false);
      };

      await closeWith(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
      await closeWith(() => drawer()!.querySelector<HTMLButtonElement>('button[aria-label="Close menu"]')!.click());
      await closeWith(() => (drawer()!.previousElementSibling as HTMLElement).click());
      await closeWith(() => drawer()!.querySelector<HTMLAnchorElement>('nav a')!.click());
    });
  });
});
