import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { of } from 'rxjs';
import { vi, describe, beforeEach, it, expect } from 'vitest';

describe('App', () => {
  let mockOidcSecurityService: any;

  beforeEach(async () => {
    mockOidcSecurityService = {
      userData$: of({ userData: null }),
      checkAuth: vi.fn(() => of(false)),
      authorize: vi.fn(),
      logoff: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: OidcSecurityService, useValue: mockOidcSecurityService }
      ]
    }).compileComponents();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain(
      'DocViewer Mock (Federated App)',
    );
  });
});
