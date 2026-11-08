import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { provideTestTranslations, useEnglish } from '../testing/translations';
import { Shell } from './shell';

describe('Shell', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Shell],
      providers: [
        provideRouter([]),
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
});
