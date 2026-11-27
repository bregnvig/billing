import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConsentBanner } from './privacy/consent-banner';
import { ReloadBanner } from './version/reload-banner';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ConsentBanner, ReloadBanner],
  template: '<router-outlet /><app-reload-banner /><app-consent-banner />',
  host: { class: 'block h-full' },
})
export class App {}
