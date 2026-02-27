import { Injectable, inject } from '@angular/core';
import { OidcSecurityService, UserDataResult } from 'angular-auth-oidc-client';
import { Observable, map, shareReplay } from 'rxjs';

/**
 * User interface represents the normalized user data used throughout the application.
 */
export interface User {
  id: string;
  name: string;
  email: string;
  roles: string[];
}

/**
 * RawUserData represents the shape of the user data returned by the OIDC provider.
 */
interface RawUserData {
  sub: string;
  name?: string;
  preferred_username?: string;
  email: string;
  role?: string | string[];
  roles?: string | string[];
}

/**
 * AuthService is the primary gateway for authentication in the frontend.
 * It uses 'angular-auth-oidc-client' to handle the protocol details.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly oidcSecurityService = inject(OidcSecurityService);

  /**
   * user$ is an Observable stream of the current user profile.
   * 
   * PIPE LOGIC:
   * 1. map: Transforms the raw OIDC 'UserDataResult' into our clean 'User' interface.
   * 2. shareReplay(1): IMPORTANT. This "remembers" the last emitted value. 
   *    If a new component subscribes, it gets the user data immediately without waiting for a new event.
   */
  public readonly user$: Observable<User | null> = this.oidcSecurityService.userData$.pipe(
    map((result: UserDataResult) => {
      if (!result.userData) {
        return null; // No user logged in.
      }

      const data = result.userData as RawUserData;
      return {
        id: data.sub, // 'sub' is the standard OIDC unique identifier (Subject).
        name: data.name || data.preferred_username || 'User',
        email: data.email,
        roles: this.extractRoles(data),
      };
    }),
    shareReplay(1)
  );

  /**
   * isAuthenticated$ is a convenience observable derived from the user state.
   */
  public readonly isAuthenticated$: Observable<boolean> = this.user$.pipe(
    map((user) => !!user)
  );

  /**
   * login() triggers the OIDC "Authorize" flow.
   * This will cause a browser redirect to the identity server.
   */
  public login(): void {
    this.oidcSecurityService.authorize();
  }

  /**
   * logout() clears the local tokens and tells the identity server to clear the session.
   */
  public logout(): void {
    this.oidcSecurityService.logoff().subscribe();
  }

  /**
   * checkAuth() should be called at app startup.
   * It checks the URL for an authorization code and handles the code-to-token exchange.
   */
  public checkAuth(): Observable<unknown> {
    return this.oidcSecurityService.checkAuth();
  }

  /**
   * extractRoles(data) handles the variation in where roles might be stored in a JWT.
   * Different identity providers use 'role' (string) or 'roles' (array).
   */
  private extractRoles(data: RawUserData): string[] {
    const roles = data.role || data.roles || [];
    return Array.isArray(roles) ? roles : [roles];
  }
}
