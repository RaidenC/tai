import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { authGuard } from './navigation.guard';
import { AuthService } from './auth.service';
import { firstValueFrom, isObservable, BehaviorSubject } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('authGuard', () => {
  let mockAuthService: {
    isAuthenticated$: BehaviorSubject<boolean>;
  };
  let mockRouter: Partial<Router>;

  beforeEach(() => {
    mockAuthService = {
      isAuthenticated$: new BehaviorSubject<boolean>(false)
    };
    mockRouter = {
      navigate: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter }
      ]
    });
  });

  it('should return true if user is authenticated', async () => {
    mockAuthService.isAuthenticated$.next(true);
    
    const result = TestBed.runInInjectionContext(() => authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
    
    const finalResult = isObservable(result) ? await firstValueFrom(result) : await result;
    expect(finalResult).toBe(true);
  });

  it('should redirect to root and return false if user is not authenticated', async () => {
    mockAuthService.isAuthenticated$.next(false);
    
    const result = TestBed.runInInjectionContext(() => authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
    
    const finalResult = isObservable(result) ? await firstValueFrom(result) : await result;
    expect(finalResult).toBe(false);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
  });
});
