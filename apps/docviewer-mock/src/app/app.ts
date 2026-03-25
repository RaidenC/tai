import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { map } from 'rxjs';

@Component({
  selector: 'tai-root',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="padding: 2rem; font-family: sans-serif;">
      <h1>DocViewer Mock (Federated App)</h1>
      <p>This application simulates a downstream module integrated with the Portal Identity.</p>
      
      @if (userData$ | async; as user) {
        <div style="border: 1px solid #ccc; padding: 1rem; border-radius: 8px;">
          <h3>Authenticated as: {{ user.name || user.email }}</h3>
          <p><strong>Roles:</strong> {{ extractRoles(user).join(', ') }}</p>
          
          <h4>Privileges Detected:</h4>
          <ul>
            @for (priv of extractPrivileges(user); track priv) {
              <li>{{ priv }}</li>
            }
          </ul>
          
          <button (click)="logout()" style="margin-top: 1rem;">Logout</button>
        </div>
      } @else {
        <div style="background: #fff3cd; padding: 1rem; border-radius: 8px;">
          <p>You are not authenticated via the Portal Identity.</p>
          <button (click)="login()">Sign In with Portal</button>
        </div>
      }
    </div>
  `,
  styles: [],
})
export class App implements OnInit {
  private readonly oidcSecurityService = inject(OidcSecurityService);
  
  protected userData$ = this.oidcSecurityService.userData$.pipe(
    map(result => result.userData)
  );

  ngOnInit() {
    this.oidcSecurityService.checkAuth().subscribe();
  }

  login() {
    this.oidcSecurityService.authorize();
  }

  logout() {
    this.oidcSecurityService.logoff();
  }

  extractRoles(userData: Record<string, unknown> | null): string[] {
    if (!userData) return [];
    const roles = userData['role'] || userData['roles'] || [];
    return Array.isArray(roles) ? roles.map(r => String(r)) : [String(roles)];
  }

  extractPrivileges(userData: Record<string, unknown> | null): string[] {
    if (!userData) return [];
    const privileges = userData['privileges'] || [];
    const roles = this.extractRoles(userData);
    
    // Mimic the super-user logic for visibility in the mock app
    if (roles.includes('Admin') || roles.includes('SystemAdmin')) {
      return [
        'Portal.Users.Read',
        'Portal.Users.Create',
        'Portal.Users.Edit',
        'Portal.Privileges.Read',
        'Portal.Privileges.Edit',
        'Portal.Approvals.Read',
        '(Super User Bypass Active)'
      ];
    }
    
    return Array.isArray(privileges) ? privileges.map(p => String(p)) : [String(privileges)];
  }
}
