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
        path: 'admin/privileges', 
        loadComponent: () => import('./features/privileges/privileges.page').then(m => m.PrivilegesPage),
        canActivate: [authGuard]
    },
    { 
        path: 'admin/privileges/:id', 
        loadComponent: () => import('./features/privileges/privilege-detail.page').then(m => m.PrivilegeDetailPage),
        canActivate: [authGuard]
    },
    { 
        path: 'users', 
        loadComponent: () => import('./features/users/users.page').then(m => m.UsersPage),
        canActivate: [authGuard]
    },
    { 
        path: 'users/:id', 
        loadComponent: () => import('./features/users/user-detail.page').then(m => m.UserDetailPage),
        canActivate: [authGuard]
    },
    { path: 'unauthorized', redirectTo: '' },
    { path: 'forbidden', redirectTo: '' },
];
