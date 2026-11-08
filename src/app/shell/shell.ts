import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { ThemeService, ThemeSetting } from '../ui/theme.service';

const THEME_ICONS: Record<ThemeSetting, string> = {
  system: 'brightness_auto',
  light: 'light_mode',
  dark: 'dark_mode',
};

/** Layout for signed-in pages: icon rail + content. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
})
export class Shell {
  readonly #router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly themeIcons = THEME_ICONS;
  protected readonly nav = [
    { path: '/week', icon: 'calendar_view_week', label: 'Week' },
    { path: '/projects', icon: 'folder', label: 'Projects' },
    { path: '/settings', icon: 'settings', label: 'Settings' },
  ];

  protected readonly signOut = async (): Promise<void> => {
    await this.auth.signOut();
    await this.#router.navigateByUrl('/login');
  };
}
