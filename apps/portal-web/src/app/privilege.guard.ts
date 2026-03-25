import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { map, take, of } from 'rxjs';

/**
 * Privilege Guard
 * 
 * JUNIOR RATIONALE: Some pages should only be accessible if the user has 
 * a specific permission (e.g., 'Portal.Users.Read'). This guard checks 
 * the 'requiredPrivilege' property from the route data.
 */
export const privilegeGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  const requiredPrivilege = route.data['requiredPrivilege'] as string | undefined;

  if (!requiredPrivilege) {
    return of(true); // No privilege required, allow entry.
  }

  return authService.hasPrivilege(requiredPrivilege).pipe(
    take(1),
    map((hasPrivilege) => {
      if (hasPrivilege) {
        return true;
      }

      // Not authorized? Send them back to the start.
      router.navigate(['/']);
      return false;
    })
  );
};
