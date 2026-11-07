import { Routes } from '@angular/router';
import { authGuard, loginGuard } from './auth/auth.guards';

export const routes: Routes = [
  {
    path: 'login',
    canMatch: [loginGuard],
    loadComponent: () => import('./auth/login.page').then((m) => m.LoginPage),
  },
  {
    path: '',
    canMatch: [authGuard],
    loadComponent: () => import('./shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'week' },
      { path: 'week', loadComponent: () => import('./week/week.page').then((m) => m.WeekPage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
