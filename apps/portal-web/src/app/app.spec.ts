import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { NxWelcome } from './nx-welcome';
import { AuthService } from './auth.service';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('App', () => {
    let authServiceMock: any;

    beforeEach(async () => {
        authServiceMock = {
            user$: of(null),
            isAuthenticated$: of(false),
            login: vi.fn(),
            logout: vi.fn(),
            checkAuth: vi.fn(() => of(false))
        };

        await TestBed.configureTestingModule({
            imports: [App, NxWelcome],
            providers: [
                { provide: AuthService, useValue: authServiceMock }
            ]
        }).compileComponents();
    });

    it('should render title', async () => {
        const fixture = TestBed.createComponent(App);
        fixture.detectChanges();
        await fixture.whenStable();
        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector('h1')?.textContent || '').toContain(
            'Portal',
        );
    });
});
