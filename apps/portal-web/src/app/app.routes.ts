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
        path: 'admin/approvals', 
        loadComponent: () => import('./features/onboarding/pages/approvals.page').then(m => m.ApprovalsPage) 
    },
    { path: 'unauthorized', redirectTo: '' },
    { path: 'forbidden', redirectTo: '' },
];
