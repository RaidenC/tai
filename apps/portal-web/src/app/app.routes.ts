import { Route } from '@angular/router';

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
        loadComponent: () => import('./features/onboarding/pages/approvals.page').then(m => m.ApprovalsPage) 
    },
    { 
        path: 'users', 
        loadComponent: () => import('./features/users/users.page').then(m => m.UsersPage) 
    },
    { path: 'unauthorized', redirectTo: '' },
    { path: 'forbidden', redirectTo: '' },
];
