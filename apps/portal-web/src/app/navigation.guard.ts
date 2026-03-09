import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { map, take } from 'rxjs';

/**
 * Authentication Guard
 * 
 * JUNIOR RATIONALE: We don't want users (or the browser) to try and visit 
 * protected pages like '/users' if they aren't logged in yet. 
 * This guard checks the 'isAuthenticated$' status and redirects them 
 * to the home page (where the login button is) if they are a guest.
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.isAuthenticated$.pipe(
    take(1), // We only need the current value once to make the decision.
    map((isAuthenticated) => {
      if (isAuthenticated) {
        return true; // Allow entry!
      }

      // Not logged in? Send them back to the start.
      router.navigate(['/']);
      return false;
    })
  );
};
