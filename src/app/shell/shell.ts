import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../auth/auth.service';
import { ToastHost } from '../ui/toast-host';

/** Tailwind's `md` breakpoint: from here the icon rail shows instead of the phone menu. */
const DESKTOP = '(min-width: 768px)';

/**
 * Layout for signed-in pages: icon rail + content. On phones (below `md`) the rail is replaced
 * by a top bar whose menu button opens the navigation as an overlay drawer.
 * Theme and language live in Settings.
 */
@Component({
  selector: 'app-shell',
  imports: [NgTemplateOutlet, RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, ToastHost],
  host: { '(document:keydown.escape)': 'closeMenu(true)' },
  templateUrl: './shell.html',
})
export class Shell {
  readonly #router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly nav = [
    { path: '/overview', icon: 'dashboard', label: 'nav.overview' },
    { path: '/week', icon: 'calendar_view_week', label: 'nav.week' },
    { path: '/projects', icon: 'folder', label: 'nav.projects' },
    { path: '/settings', icon: 'settings', label: 'nav.settings' },
  ];

  /** The phone menu drawer. */
  protected readonly menuOpen = signal(false);
  protected readonly menuButton = viewChild<ElementRef<HTMLElement>>('menuButton');
  protected readonly drawer = viewChild<ElementRef<HTMLElement>>('drawer');

  constructor() {
    // Growing past the breakpoint hides the drawer; close it so the page isn't left inert.
    const desktop = window.matchMedia?.(DESKTOP);
    const onChange = (e: MediaQueryListEvent) => e.matches && this.closeMenu();
    desktop?.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => desktop?.removeEventListener('change', onChange));
  }

  protected readonly openMenu = (): void => {
    this.menuOpen.set(true);
    // Focus the current page's link (or the first one) once the drawer is rendered.
    setTimeout(() => {
      const drawer = this.drawer()?.nativeElement;
      (drawer?.querySelector<HTMLElement>('a[aria-current=page]') ?? drawer?.querySelector<HTMLElement>('a'))?.focus();
    });
  };

  /** Closes the drawer; `returnFocus` puts focus back on the menu button (Esc, close button, backdrop). */
  protected readonly closeMenu = (returnFocus = false): void => {
    if (!this.menuOpen()) return;
    this.menuOpen.set(false);
    if (returnFocus) setTimeout(() => this.menuButton()?.nativeElement.focus());
  };

  protected readonly signOut = async (): Promise<void> => {
    this.closeMenu();
    await this.auth.signOut();
    await this.#router.navigateByUrl('/login');
  };
}
