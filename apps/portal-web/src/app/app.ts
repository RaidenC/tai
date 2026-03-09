import { Component, inject, OnInit } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './auth.service';
import { AppShellComponent, MenuItem } from '@tai/ui-design-system';
import { OnboardingStore } from './features/onboarding/onboarding.store';

@Component({
    imports: [RouterModule, CommonModule, AppShellComponent],
    selector: 'app-root',
    templateUrl: './app.html',
    styleUrl: './app.scss',
})
export class App implements OnInit {
    private readonly authService = inject(AuthService);
    public readonly router = inject(Router);
    protected readonly onboardingStore = inject(OnboardingStore);
    
    protected title = 'portal-web';
    protected user$ = this.authService.user$;
    protected isAuthenticated$ = this.authService.isAuthenticated$;

    protected menuItems: MenuItem[] = [
        { label: 'Collections', link: '/collections', icon: '📥' },
        { label: 'Payments', link: '/payments', icon: '💰' },
        { label: 'Insurance', link: '/insurance', icon: '🛡️' },
        { label: 'Reports', link: '/reports', icon: '📊' },
        { label: 'Settings', link: '/settings', icon: '⚙️' },
        { label: 'Users', link: '/users', icon: '👥' },
    ];

    ngOnInit() {
        this.authService.checkAuth().subscribe();
        this.isAuthenticated$.subscribe(auth => {
          if (auth) {
            this.onboardingStore.loadPendingApprovals();
          }
        });
    }

    login() {
        this.authService.login();
    }

    logout() {
        this.authService.logout();
    }
}