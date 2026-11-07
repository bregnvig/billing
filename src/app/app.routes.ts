import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'week' },
  { path: 'week', loadComponent: () => import('./week/week.page').then((m) => m.WeekPage) },
  { path: '**', redirectTo: 'week' },
];
