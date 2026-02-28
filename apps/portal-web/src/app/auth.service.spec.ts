import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { OidcSecurityService, UserDataResult } from 'angular-auth-oidc-client';
import { BehaviorSubject, of, take, firstValueFrom, skip } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideRouter } from '@angular/router';

describe('AuthService', () => {
  let service: AuthService;
  let oidcSecurityServiceMock: Partial<OidcSecurityService>;
  let mockUserDataSubject: BehaviorSubject<UserDataResult>;

  beforeEach(() => {
    mockUserDataSubject = new BehaviorSubject<UserDataResult>({ 
      userData: null, 
      allUserData: []
    });

    oidcSecurityServiceMock = {
      authorize: vi.fn(),
      logoff: vi.fn(() => of(null)),
      checkAuth: vi.fn(() => of({ isAuthenticated: false, allConfigsAuthenticated: [], userCustomParameters: {}, accessToken: '', idToken: '', userData: null })),
      userData$: mockUserDataSubject.asObservable(),
    };

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: OidcSecurityService, useValue: oidcSecurityServiceMock },
        provideRouter([])
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

  it('should call checkAuth when checkAuth is called', () => {
    service.checkAuth();
    expect(oidcSecurityServiceMock.checkAuth).toHaveBeenCalled();
  });

  it('should update isAuthenticated$ based on user$ state', async () => {
    const mockRawUser = {
      sub: '123',
      name: 'Test User',
      email: 'test@tai.com',
      role: ['Admin']
    };

    const userPromise = firstValueFrom(service.user$.pipe(skip(1)));

    mockUserDataSubject.next({ 
      userData: mockRawUser, 
      allUserData: [{ configId: 'test', userData: mockRawUser }]
    });

    const user = await userPromise;
    expect(user).toBeTruthy();
    expect(user?.id).toBe('123');
    expect(user?.name).toBe('Test User');
    expect(user?.email).toBe('test@tai.com');
    expect(user?.roles).toContain('Admin');
  });

  it('should extract roles from single string', async () => {
    const mockRawUser = {
      sub: '456',
      name: 'Single Role User',
      email: 'single@tai.com',
      role: 'Editor'
    };

    const userPromise = firstValueFrom(service.user$.pipe(skip(1)));

    mockUserDataSubject.next({ 
      userData: mockRawUser, 
      allUserData: []
    });

    const user = await userPromise;
    expect(user).toBeTruthy();
    expect(user?.id).toBe('456');
    expect(user?.roles).toContain('Editor');
    expect(user?.roles.length).toBe(1);
  });

  it('should emit null user when userData is null', async () => {
    const userPromise = firstValueFrom(service.user$.pipe(take(1)));

    mockUserDataSubject.next({ 
      userData: null, 
      allUserData: []
    });

    const user = await userPromise;
    expect(user).toBeNull();
  });
});
