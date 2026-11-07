import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { Shell } from './shell';

describe('Shell', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Shell],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            user: signal({ email: 'flemming@loopme.dk' }),
            signOut: async () => {},
          },
        },
      ],
    }).compileComponents();
  });

  it('renders the rail with navigation, theme toggle and sign-out', async () => {
    const fixture = TestBed.createComponent(Shell);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('nav[aria-label="Main"] a[aria-label="Week"]')).toBeTruthy();
    expect(el.querySelector('button[aria-label^="Theme:"]')).toBeTruthy();
    expect(el.querySelector('button[aria-label="Sign out flemming@loopme.dk"]')).toBeTruthy();
  });
});
