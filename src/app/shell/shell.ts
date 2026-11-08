import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../auth/auth.service';
import { ToastHost } from '../ui/toast-host';

/** Layout for signed-in pages: icon rail + content. Theme and language live in Settings. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, ToastHost],
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

  protected readonly signOut = async (): Promise<void> => {
    await this.auth.signOut();
    await this.#router.navigateByUrl('/login');
  };
}
