import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { AuthService } from './auth.service';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideRouter } from '@angular/router';

describe('App', () => {
    let authServiceMock: Partial<AuthService>;

    beforeEach(async () => {
        authServiceMock = {
            user$: of(null),
            isAuthenticated$: of(false),
            login: vi.fn(),
            logout: vi.fn(),
            checkAuth: vi.fn(() => of(false))
        };

        await TestBed.configureTestingModule({
            imports: [App],
            providers: [
                { provide: AuthService, useValue: authServiceMock },
                provideRouter([])
            ]
        }).compileComponents();
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

    it('should render app shell when authenticated', async () => {
        // @ts-expect-error - access protected
        authServiceMock.isAuthenticated$ = of(true);
        // @ts-expect-error - access protected
        authServiceMock.user$ = of({ id: '1', name: 'John Doe', email: 'john@tai.com', roles: [] });
        
        const fixture = TestBed.createComponent(App);
        fixture.detectChanges();
        await fixture.whenStable();
        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector('tai-app-shell')).toBeTruthy();
    });

    it('should call logout when app shell emits logout', async () => {
        // @ts-expect-error - access protected
        authServiceMock.isAuthenticated$ = of(true);
        
        const fixture = TestBed.createComponent(App);
        fixture.detectChanges();
        const app = fixture.componentInstance;
        app.logout();
        expect(authServiceMock.logout).toHaveBeenCalled();
    });

    it('should render welcome content if title is not portal-web', async () => {
        // @ts-expect-error - access protected
        authServiceMock.isAuthenticated$ = of(true);
        
        const fixture = TestBed.createComponent(App);
        const app = fixture.componentInstance;
        // @ts-expect-error - access protected
        app.title = 'other';
        fixture.detectChanges();
        await fixture.whenStable();
        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector('.welcome-content')).toBeTruthy();
    });
});
