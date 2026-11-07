import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ThemeService, ThemeSetting } from './ui/theme.service';

const THEME_ICONS: Record<ThemeSetting, string> = {
  system: 'brightness_auto',
  light: 'light_mode',
  dark: 'dark_mode',
};

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
})
export class App {
  protected readonly theme = inject(ThemeService);
  protected readonly themeIcons = THEME_ICONS;
  protected readonly nav = [
    { path: '/week', icon: 'calendar_view_week', label: 'Week' },
    { path: '/projects', icon: 'folder', label: 'Projects' },
  ];
}
