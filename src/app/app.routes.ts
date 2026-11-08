import { Routes } from '@angular/router';
import { authGuard, loginGuard } from './auth/auth.guards';

export const routes: Routes = [
  {
    path: 'login',
    canMatch: [loginGuard],
    loadComponent: () => import('./auth/login.page').then(m => m.LoginPage),
  },
  {
    // Lazy: the shell, its pages and Firestore/Functions only load after sign-in.
    path: '',
    canMatch: [authGuard],
    loadChildren: () => import('./shell/shell.routes').then(m => m.shellRoutes),
  },
  { path: '**', redirectTo: '' },
];
