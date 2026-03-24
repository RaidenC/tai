import { Component, inject, OnInit } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './auth.service';
import { AppShellComponent, MenuItem } from '@tai/ui-design-system';
import { OnboardingStore } from './features/onboarding/onboarding.store';
import { RealTimeService } from './real-time.service';
import { combineLatest, map, of } from 'rxjs';

@Component({
    imports: [RouterModule, CommonModule, AppShellComponent],
    selector: 'app-root',
    templateUrl: './app.html',
    styleUrl: './app.scss',
})
export class App implements OnInit {
    private readonly authService = inject(AuthService);
    private readonly realTimeService = inject(RealTimeService); // Ensure RealTimeService is initialized
    public readonly router = inject(Router);
    protected readonly onboardingStore = inject(OnboardingStore);
    
    protected title = 'portal-web';
    protected user$ = this.authService.user$;
    protected isAuthenticated$ = this.authService.isAuthenticated$;

    private readonly allMenuItems: (MenuItem & { requiredPrivilege?: string })[] = [
        { label: 'Collections', link: '/collections', icon: '📥' },
        { label: 'Payments', link: '/payments', icon: '💰' },
        { label: 'Insurance', link: '/insurance', icon: '🛡️' },
        { label: 'Reports', link: '/reports', icon: '📊' },
        { label: 'Settings', link: '/settings', icon: '⚙️' },
        { label: 'Users', link: '/users', icon: '👥', requiredPrivilege: 'Portal.Users.Read' },
        { label: 'Privileges', link: '/admin/privileges', icon: '🛡️', requiredPrivilege: 'Portal.Privileges.Read' },
        { label: 'Approvals', link: '/admin/approvals', icon: '✅', requiredPrivilege: 'Portal.Approvals.Read' },
    ];

    protected menuItems$ = combineLatest(
      this.allMenuItems.map(item => 
        item.requiredPrivilege 
          ? this.authService.hasPrivilege(item.requiredPrivilege).pipe(map(has => ({ item, has })))
          : combineLatest([of(item), of(true)]).pipe(map(([i, h]) => ({ item: i, has: h })))
      )
    ).pipe(
      map(results => results.filter(r => r.has).map(r => r.item))
    );

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