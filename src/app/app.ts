import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConsentBanner } from './privacy/consent-banner';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ConsentBanner],
  template: '<router-outlet /><app-consent-banner />',
  host: { class: 'block h-full' },
})
export class App {}
