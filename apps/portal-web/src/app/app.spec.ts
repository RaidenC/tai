import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { AuthService } from './auth.service';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideRouter } from '@angular/router';
import { signal, NO_ERRORS_SCHEMA } from '@angular/core';
import { OnboardingStore } from './features/onboarding/onboarding.store';
import { PrivilegeNotificationService } from './features/privileges/privilege-notification.service';
import { TAI_AUTH_SERVICE } from '@tai/ui-design-system';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

describe('App', () => {
    let authServiceMock: Partial<AuthService>;
    let onboardingStoreMock: any;
    let privilegeNotificationMock: any;

    beforeEach(async () => {
        authServiceMock = {
            user$: of(null),
            isAuthenticated$: of(false),
            login: vi.fn(),
            logout: vi.fn(),
            checkAuth: vi.fn(() => of(false)),
            hasPrivilege: vi.fn(() => of(true))
        };

        onboardingStoreMock = {
            isLoading: signal(false),
            pendingUsers: signal([]),
            loadPendingApprovals: vi.fn(),
        };

        privilegeNotificationMock = {
            init: vi.fn(),
            stopConnection: vi.fn(),
        };

        await TestBed.configureTestingModule({
            imports: [App, CommonModule],
            providers: [
                { provide: AuthService, useValue: authServiceMock },
                { provide: OnboardingStore, useValue: onboardingStoreMock },
                { provide: PrivilegeNotificationService, useValue: privilegeNotificationMock },
                { provide: TAI_AUTH_SERVICE, useValue: authServiceMock },
                provideRouter([])
            ]
        })
        .overrideComponent(App, {
          set: {
            imports: [CommonModule, RouterModule],
            schemas: [NO_ERRORS_SCHEMA]
          }
        })
        .compileComponents();
    });

    it('should render login button when not authenticated', async () => {
        const fixture = TestBed.createComponent(App);
        fixture.detectChanges();
        await fixture.whenStable();
        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector('.login-btn')).toBeTruthy();
    });

    it('should call login when button clicked', async () => {
        const fixture = TestBed.createComponent(App);
        fixture.detectChanges();
        const button = fixture.nativeElement.querySelector('.login-btn');
        button.click();
        expect(authServiceMock.login).toHaveBeenCalled();
    });

    it('should render auth state correctly (smoke test)', async () => {
        // Since we are using NO_ERRORS_SCHEMA, we just check that the component compiles
        // and doesn't crash during authentication state changes.
        // @ts-expect-error - access protected
        authServiceMock.isAuthenticated$ = of(true);
        // @ts-expect-error - access protected
        authServiceMock.user$ = of({ id: '1', name: 'John Doe', email: 'john@tai.com', roles: [] });
        
        const fixture = TestBed.createComponent(App);
        fixture.detectChanges();
        expect(fixture.componentInstance).toBeTruthy();
    });

    it('should call logout', async () => {
        const fixture = TestBed.createComponent(App);
        fixture.detectChanges();
        const app = fixture.componentInstance;
        app.logout();
        expect(authServiceMock.logout).toHaveBeenCalled();
    });
});
