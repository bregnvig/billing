import { Routes } from '@angular/router';
import { DevicesService } from '../settings/devices.service';
import { ProjectsService } from '../data/projects.service';
import { TimeEntriesService } from '../data/time-entries.service';
import { provideFirebaseData } from '../firebase/firebase-data.providers';
import { Shell } from './shell';

/**
 * Everything behind sign-in, loaded lazily. Firestore, Functions and the services that use them
 * are provided here rather than at the root, so their SDKs stay out of the initial bundle.
 */
export const shellRoutes: Routes = [
  {
    path: '',
    component: Shell,
    providers: [provideFirebaseData(), ProjectsService, TimeEntriesService, DevicesService],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      { path: 'overview', loadComponent: () => import('../overview/overview.page').then(m => m.OverviewPage) },
      { path: 'week', loadComponent: () => import('../week/week.page').then(m => m.WeekPage) },
      { path: 'projects', loadComponent: () => import('../projects/projects.page').then(m => m.ProjectsPage) },
      { path: 'settings', loadComponent: () => import('../settings/settings.page').then(m => m.SettingsPage) },
    ],
  },
];
