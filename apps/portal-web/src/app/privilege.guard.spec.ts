import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { privilegeGuard } from './privilege.guard';
import { AuthService } from './auth.service';
import { firstValueFrom, isObservable, of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('privilegeGuard', () => {
  let mockAuthService: any;
  let mockRouter: any;

  beforeEach(() => {
    mockAuthService = {
      hasPrivilege: vi.fn()
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

  it('should return true if user has required privilege', async () => {
    mockAuthService.hasPrivilege.mockReturnValue(of(true));
    
    // Setup route data with required privilege
    const route = { data: { requiredPrivilege: 'test.privilege' } } as any as ActivatedRouteSnapshot;
    
    const result = TestBed.runInInjectionContext(() => privilegeGuard(route, {} as RouterStateSnapshot));
    
    const finalResult = isObservable(result) ? await firstValueFrom(result) : await result;
    expect(finalResult).toBe(true);
    expect(mockAuthService.hasPrivilege).toHaveBeenCalledWith('test.privilege');
  });

  it('should redirect to root and return false if user lacks privilege', async () => {
    mockAuthService.hasPrivilege.mockReturnValue(of(false));
    
    const route = { data: { requiredPrivilege: 'test.privilege' } } as any as ActivatedRouteSnapshot;
    
    const result = TestBed.runInInjectionContext(() => privilegeGuard(route, {} as RouterStateSnapshot));
    
    const finalResult = isObservable(result) ? await firstValueFrom(result) : await result;
    expect(finalResult).toBe(false);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
  });

  it('should return true if no requiredPrivilege is defined in route data', async () => {
    const route = { data: {} } as any as ActivatedRouteSnapshot;
    
    const result = TestBed.runInInjectionContext(() => privilegeGuard(route, {} as RouterStateSnapshot));
    
    const finalResult = isObservable(result) ? await firstValueFrom(result) : await result;
    expect(finalResult).toBe(true);
  });
});
