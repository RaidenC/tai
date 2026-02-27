import { TestBed } from '@angular/core/testing';
import { AuthService, User } from './auth.service';
import { OidcSecurityService, UserDataResult } from 'angular-auth-oidc-client';
import { BehaviorSubject, of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('AuthService', () => {
  let service: AuthService;
  let oidcSecurityServiceMock: any;

  const mockUserDataSubject = new BehaviorSubject<UserDataResult>({ 
    userData: null, 
    allUserData: []
  });

  beforeEach(() => {
    oidcSecurityServiceMock = {
      authorize: vi.fn(),
      logoff: vi.fn(() => of(null)),
      checkAuth: vi.fn(() => of({ isAuthenticated: false, allConfigsAuthenticated: [], userCustomParameters: {}, accessToken: '', idToken: '' })),
      userData$: mockUserDataSubject.asObservable(),
    };

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: OidcSecurityService, useValue: oidcSecurityServiceMock }
      ]
    });

    service = TestBed.inject(AuthService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call authorize when login is called', () => {
    service.login();
    expect(oidcSecurityServiceMock.authorize).toHaveBeenCalled();
  });

  it('should call logoff when logout is called', () => {
    service.logout();
    expect(oidcSecurityServiceMock.logoff).toHaveBeenCalled();
  });

  it('should update isAuthenticated$ based on user$ state', () => {
    return new Promise<void>((resolve) => {
      const mockRawUser = {
        sub: '123',
        name: 'Test User',
        email: 'test@tai.com',
        role: ['Admin']
      };

      mockUserDataSubject.next({ 
        userData: mockRawUser, 
        allUserData: [{ configId: 'test', userData: mockRawUser }]
      });

      service.isAuthenticated$.subscribe(isAuthenticated => {
        if (isAuthenticated) {
          expect(isAuthenticated).toBe(true);
          resolve();
        }
      });
    });
  });

  it('should map and emit user data when oidcSecurityService.userData$ emits', () => {
    return new Promise<void>((resolve) => {
      const mockRawUser = {
        sub: '123',
        name: 'Test User',
        email: 'test@tai.com',
        role: ['Admin']
      };

      mockUserDataSubject.next({ 
        userData: mockRawUser, 
        allUserData: [{ configId: 'test', userData: mockRawUser }]
      });

      service.user$.subscribe(user => {
        if (user) {
          expect(user.id).toBe('123');
          expect(user.name).toBe('Test User');
          expect(user.email).toBe('test@tai.com');
          expect(user.roles).toContain('Admin');
          resolve();
        }
      });
    });
  });

  it('should emit null user when userData is null', () => {
    return new Promise<void>((resolve) => {
      mockUserDataSubject.next({ 
        userData: null, 
        allUserData: []
      });
      service.user$.subscribe(user => {
        if (user === null) {
          expect(user).toBeNull();
          resolve();
        }
      });
    });
  });
});


