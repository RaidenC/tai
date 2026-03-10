import { Route } from '@angular/router';
import { authGuard } from './navigation.guard';

export const appRoutes: Route[] = [
    { 
        path: 'register', 
        loadComponent: () => import('./features/onboarding/pages/register.page').then(m => m.RegisterPage) 
    },
    { 
        path: 'verify', 
        loadComponent: () => import('./features/onboarding/pages/verify.page').then(m => m.VerifyPage) 
    },
    { 
        path: 'create-passkey', 
        loadComponent: () => import('./features/onboarding/pages/create-passkey.page').then(m => m.CreatePasskeyPage) 
    },
    { 
        path: 'admin/approvals', 
        loadComponent: () => import('./features/onboarding/pages/approvals.page').then(m => m.ApprovalsPage),
        canActivate: [authGuard]
    },
    { 
        path: 'users', 
        loadComponent: () => import('./features/users/users.page').then(m => m.UsersPage),
        canActivate: [authGuard]
    },
    { path: 'unauthorized', redirectTo: '' },
    { path: 'forbidden', redirectTo: '' },
];
