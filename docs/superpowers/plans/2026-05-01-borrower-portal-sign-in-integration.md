# Borrower Portal Sign-In Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Portal Identity sign-in to `borrower-portal` so an unauthenticated borrower sees a sign-in button, is redirected through `identity-ui`, returns to Borrower Portal, and sees normalized user data plus raw OIDC claims before continuing the claim wizard.

**Architecture:** Reuse the existing `angular-auth-oidc-client` pattern from `apps/docviewer-mock` and `apps/portal-web`. Borrower Portal gets its own small `BorrowerAuthService`, OIDC config in `app.config.ts`, an app-level authenticated/unauthenticated shell in `App`, and OpenIddict redirect URI registration for `http://localhost:4202`.

**Tech Stack:** Angular standalone components, Angular router, `angular-auth-oidc-client`, RxJS, Vitest/Angular TestBed, OpenIddict seed data in `apps/portal-api`.

---

## Scope Notes

This plan intentionally does not implement DocuSign, signing-session APIs, signed document storage, or borrower API bearer-token validation. It helps the previous signing design by replacing anonymous/hardcoded frontend identity with a real Portal Identity user and OIDC claims. It does not solve authoritative claim snapshots, signed document storage, canonical signing statuses, or DocuSign webhook trust.

For this slice, “claims” means OIDC/user claims, not disability insurance claims.

## File Structure

- Modify `apps/portal-api/SeedData.cs`: register Borrower Portal redirect/post-logout URIs for the existing public `portal-web` OIDC client.
- Modify `apps/portal-api.integration-tests/OidcClientRegistrationTests.cs`: assert Borrower Portal redirect URIs are registered.
- Create `apps/borrower-portal/src/app/auth/borrower-auth.service.ts`: normalize OIDC user data and expose login/logout/checkAuth/user state.
- Create `apps/borrower-portal/src/app/auth/borrower-auth.service.spec.ts`: cover user normalization, role extraction, and unauthenticated state.
- Modify `apps/borrower-portal/src/app/app.config.ts`: add OIDC provider and auth HTTP interceptor.
- Modify `apps/borrower-portal/src/app/app.ts`: call `checkAuth()`, expose authenticated state/user/claims, and provide login/logout methods.
- Modify `apps/borrower-portal/src/app/app.html`: gate the router outlet behind authenticated state and render a sign-in panel when unauthenticated.
- Modify `apps/borrower-portal/src/app/app.scss`: add restrained borrower portal auth shell styles.
- Modify `apps/borrower-portal/src/app/app.spec.ts`: add auth gate/sign-in/logout tests while preserving crypto gate tests.

---

### Task 1: Register Borrower Portal Redirect URIs

**Files:**
- Modify: `apps/portal-api/SeedData.cs`
- Test: `apps/portal-api.integration-tests/OidcClientRegistrationTests.cs`

- [ ] **Step 1: Write failing integration test assertions**

In `apps/portal-api.integration-tests/OidcClientRegistrationTests.cs`, find the test that verifies the `portal-web` OIDC client redirect URIs. Add these assertions beside the existing `localhost:4200` assertions:

```csharp
Assert.Contains(new Uri("http://localhost:4202"), descriptor.RedirectUris);
Assert.Contains(new Uri("https://localhost:4202"), descriptor.RedirectUris);
Assert.Contains(new Uri("http://localhost:4202"), descriptor.PostLogoutRedirectUris);
Assert.Contains(new Uri("https://localhost:4202"), descriptor.PostLogoutRedirectUris);
```

- [ ] **Step 2: Run the targeted integration test and verify it fails**

Run:

```bash
npx nx test portal-api.integration-tests --testNamePattern=portal-web
```

Expected: FAIL because `http://localhost:4202` and `https://localhost:4202` are not registered.

- [ ] **Step 3: Add Borrower Portal redirect URIs to OpenIddict seed data**

In `apps/portal-api/SeedData.cs`, update the `portal-web` `OpenIddictApplicationDescriptor` URI collections:

```csharp
RedirectUris =
  {
            new Uri("https://localhost:4200"),
            new Uri("http://localhost:4200"),
            new Uri("http://acme.localhost:4200"),
            new Uri("http://localhost:4201"),
            new Uri("https://localhost:4202"),
            new Uri("http://localhost:4202")
        },
PostLogoutRedirectUris =
  {
            new Uri("https://localhost:4200"),
            new Uri("http://localhost:4200"),
            new Uri("http://acme.localhost:4200"),
            new Uri("http://localhost:4201"),
            new Uri("https://localhost:4202"),
            new Uri("http://localhost:4202")
        }
```

- [ ] **Step 4: Run the targeted integration test and verify it passes**

Run:

```bash
npx nx test portal-api.integration-tests --testNamePattern=portal-web
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/portal-api/SeedData.cs apps/portal-api.integration-tests/OidcClientRegistrationTests.cs
git commit -m "test: register borrower portal oidc redirect uris"
```

---

### Task 2: Add Borrower Auth Service

**Files:**
- Create: `apps/borrower-portal/src/app/auth/borrower-auth.service.ts`
- Create: `apps/borrower-portal/src/app/auth/borrower-auth.service.spec.ts`

- [ ] **Step 1: Write failing auth service tests**

Create `apps/borrower-portal/src/app/auth/borrower-auth.service.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { OidcSecurityService, UserDataResult } from 'angular-auth-oidc-client';
import { BehaviorSubject, Observable, map, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BorrowerAuthService } from './borrower-auth.service';

describe('BorrowerAuthService', () => {
  let userDataSubject: BehaviorSubject<UserDataResult>;
  let oidcSecurityService: {
    userData$: BehaviorSubject<UserDataResult>;
    authorize: ReturnType<typeof vi.fn>;
    logoff: ReturnType<typeof vi.fn>;
    checkAuth: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    userDataSubject = new BehaviorSubject<UserDataResult>({
      userData: null,
      allConfigsAuthenticated: [],
    });

    oidcSecurityService = {
      userData$: userDataSubject,
      authorize: vi.fn(),
      logoff: vi.fn(() => of(null)),
      checkAuth: vi.fn(() => of({ isAuthenticated: true })),
    };

    TestBed.configureTestingModule({
      providers: [
        BorrowerAuthService,
        { provide: OidcSecurityService, useValue: oidcSecurityService },
      ],
    });
  });

  it('returns null when no OIDC user data exists', async () => {
    const service = TestBed.inject(BorrowerAuthService);

    await expect(firstValue(service.user$)).resolves.toBeNull();
  });

  it('normalizes borrower user data and raw claims', async () => {
    const service = TestBed.inject(BorrowerAuthService);

    userDataSubject.next({
      userData: {
        sub: '00000000-0000-0000-0000-000000000010',
        email: 'admin@tai.com',
        name: 'TAI Admin',
        role: ['Admin'],
        privileges: ['Portal.Users.Read'],
      },
      allConfigsAuthenticated: [],
    });

    await expect(firstValue(service.user$)).resolves.toEqual({
      id: '00000000-0000-0000-0000-000000000010',
      name: 'TAI Admin',
      email: 'admin@tai.com',
      roles: ['Admin'],
      privileges: ['Portal.Users.Read'],
      rawClaims: {
        sub: '00000000-0000-0000-0000-000000000010',
        email: 'admin@tai.com',
        name: 'TAI Admin',
        role: ['Admin'],
        privileges: ['Portal.Users.Read'],
      },
    });
  });

  it('delegates login, logout, and startup auth checks to OIDC service', () => {
    const service = TestBed.inject(BorrowerAuthService);

    service.login();
    service.logout();
    service.checkAuth().subscribe();

    expect(oidcSecurityService.authorize).toHaveBeenCalledOnce();
    expect(oidcSecurityService.logoff).toHaveBeenCalledOnce();
    expect(oidcSecurityService.checkAuth).toHaveBeenCalledOnce();
  });
});

async function firstValue<T>(source: Observable<T>): Promise<T> {
  return await new Promise<T>((resolve) => {
    const subscription = source.subscribe((value) => {
      resolve(value);
      subscription.unsubscribe();
    });
  });
}
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
npx nx test borrower-portal --testFile=apps/borrower-portal/src/app/auth/borrower-auth.service.spec.ts
```

Expected: FAIL because `BorrowerAuthService` does not exist.

- [ ] **Step 3: Implement the auth service**

Create `apps/borrower-portal/src/app/auth/borrower-auth.service.ts`:

```typescript
import { Injectable, inject } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { Observable, map, shareReplay } from 'rxjs';

export interface BorrowerUser {
  id: string;
  name: string;
  email: string;
  roles: string[];
  privileges: string[];
  rawClaims: Record<string, unknown>;
}

interface RawBorrowerUserData {
  sub?: string;
  name?: string;
  preferred_username?: string;
  email?: string;
  role?: string | string[];
  roles?: string | string[];
  privileges?: string[];
}

@Injectable({
  providedIn: 'root',
})
export class BorrowerAuthService {
  private readonly oidcSecurityService = inject(OidcSecurityService);

  public readonly user$: Observable<BorrowerUser | null> =
    this.oidcSecurityService.userData$.pipe(
      map((result) => {
        if (!result.userData) {
          return null;
        }

        const rawClaims = result.userData as RawBorrowerUserData & Record<string, unknown>;

        return {
          id: rawClaims.sub ?? '',
          name: rawClaims.name ?? rawClaims.preferred_username ?? rawClaims.email ?? 'Borrower',
          email: rawClaims.email ?? '',
          roles: this.extractRoles(rawClaims),
          privileges: rawClaims.privileges ?? [],
          rawClaims,
        };
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

  public readonly isAuthenticated$: Observable<boolean> = this.user$.pipe(
    map((user) => user !== null),
  );

  public login(): void {
    this.oidcSecurityService.authorize();
  }

  public logout(): void {
    this.oidcSecurityService.logoff().subscribe();
  }

  public checkAuth(): Observable<unknown> {
    return this.oidcSecurityService.checkAuth();
  }

  private extractRoles(data: RawBorrowerUserData): string[] {
    const roles = data.role ?? data.roles ?? [];
    return Array.isArray(roles) ? roles.map(String) : [String(roles)];
  }
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run:

```bash
npx nx test borrower-portal --testFile=apps/borrower-portal/src/app/auth/borrower-auth.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/borrower-portal/src/app/auth/borrower-auth.service.ts apps/borrower-portal/src/app/auth/borrower-auth.service.spec.ts
git commit -m "feat: add borrower portal auth service"
```

---

### Task 3: Configure Borrower Portal OIDC Client

**Files:**
- Modify: `apps/borrower-portal/src/app/app.config.ts`

- [ ] **Step 1: Add OIDC provider and auth interceptor**

Modify `apps/borrower-portal/src/app/app.config.ts` so the imports include auth provider symbols and the HTTP client registers the OIDC interceptor:

```typescript
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAuth, LogLevel, authInterceptor } from 'angular-auth-oidc-client';
```

Add this local config near the imports:

```typescript
const SYSTEM_CONFIG = {
  gatewayPort: 5217,
  identityPath: '/identity',
};
```

Replace:

```typescript
provideHttpClient(),
```

with:

```typescript
provideHttpClient(withInterceptors([authInterceptor()])),
```

Add this provider after `provideHttpClient(...)`:

```typescript
provideAuth({
  config: {
    authority: `http://${window.location.hostname}:${SYSTEM_CONFIG.gatewayPort}`,
    authWellknownEndpoints: {
      issuer: `http://${window.location.hostname}:${SYSTEM_CONFIG.gatewayPort}/`,
      authorizationEndpoint: `http://${window.location.hostname}:${SYSTEM_CONFIG.gatewayPort}${SYSTEM_CONFIG.identityPath}/connect/authorize`,
      tokenEndpoint: `http://${window.location.hostname}:${SYSTEM_CONFIG.gatewayPort}${SYSTEM_CONFIG.identityPath}/connect/token`,
      userInfoEndpoint: `http://${window.location.hostname}:${SYSTEM_CONFIG.gatewayPort}${SYSTEM_CONFIG.identityPath}/connect/userinfo`,
      jwksUri: `http://${window.location.hostname}:${SYSTEM_CONFIG.gatewayPort}${SYSTEM_CONFIG.identityPath}/.well-known/jwks`,
      revocationEndpoint: `http://${window.location.hostname}:${SYSTEM_CONFIG.gatewayPort}${SYSTEM_CONFIG.identityPath}/connect/logout`,
      introspectionEndpoint: `http://${window.location.hostname}:${SYSTEM_CONFIG.gatewayPort}${SYSTEM_CONFIG.identityPath}/connect/introspect`,
    },
    redirectUrl: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
    clientId: 'portal-web',
    scope: 'openid profile email offline_access roles',
    responseType: 'code',
    silentRenew: true,
    useRefreshToken: true,
    autoUserInfo: false,
    renewTimeBeforeTokenExpiresInSeconds: 30,
    logLevel: LogLevel.Debug,
    secureRoutes: [environment.apiBaseUrl],
  },
}),
```

Ensure `environment` remains imported from `../environments/environment`.

- [ ] **Step 2: Run borrower portal tests**

Run:

```bash
npx nx test borrower-portal
```

Expected: existing app tests may fail because `OidcSecurityService` is now injected through `BorrowerAuthService`; Task 4 updates those tests.

- [ ] **Step 3: Commit after Task 4 passes**

Do not commit this task independently if tests fail. Commit together with Task 4.

---

### Task 4: Add App-Level Auth Gate and User Claims Display

**Files:**
- Modify: `apps/borrower-portal/src/app/app.ts`
- Modify: `apps/borrower-portal/src/app/app.html`
- Modify: `apps/borrower-portal/src/app/app.scss`
- Modify: `apps/borrower-portal/src/app/app.spec.ts`

- [ ] **Step 1: Write failing app component tests**

Replace `apps/borrower-portal/src/app/app.spec.ts` with:

```typescript
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject, Observable, map, of } from 'rxjs';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { App } from './app';
import { BorrowerAuthService, BorrowerUser } from './auth/borrower-auth.service';
import { CryptoStorageService } from './claim/services/crypto-storage.service';
import { SecurityLoggerService } from './claim/services/security-logger.service';

describe('App', () => {
  let loggerSpy: { log: ReturnType<typeof vi.fn> };
  let userSubject: BehaviorSubject<BorrowerUser | null>;
  let authService: {
    user$: BehaviorSubject<BorrowerUser | null>;
    isAuthenticated$: Observable<boolean>;
    checkAuth: ReturnType<typeof vi.fn>;
    login: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    loggerSpy = { log: vi.fn() };
    userSubject = new BehaviorSubject<BorrowerUser | null>(null);
    authService = {
      user$: userSubject,
      isAuthenticated$: userSubject.pipe(map((user) => user !== null)),
      checkAuth: vi.fn(() => of({ isAuthenticated: false })),
      login: vi.fn(),
      logout: vi.fn(),
    };
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('logs CRYPTO_UNAVAILABLE when crypto.subtle is missing', async () => {
    vi.spyOn(CryptoStorageService, 'isAvailable').mockReturnValue(false);
    await configure();

    TestBed.createComponent(App);

    expect(loggerSpy.log).toHaveBeenCalledWith(
      'CRYPTO_UNAVAILABLE',
      expect.any(String),
    );
  });

  it('shows sign-in panel when crypto is available and user is not authenticated', async () => {
    vi.spyOn(CryptoStorageService, 'isAvailable').mockReturnValue(true);
    await configure();

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="borrower-sign-in"]')).not.toBeNull();
    expect(compiled.textContent).toContain('Sign in to continue');
  });

  it('starts Portal Identity sign-in when sign-in button is clicked', async () => {
    vi.spyOn(CryptoStorageService, 'isAvailable').mockReturnValue(true);
    await configure();

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('[data-testid="borrower-sign-in-button"]') as HTMLButtonElement;

    button.click();

    expect(authService.login).toHaveBeenCalledOnce();
  });

  it('renders authenticated user and raw claims before the claim wizard', async () => {
    vi.spyOn(CryptoStorageService, 'isAvailable').mockReturnValue(true);
    userSubject.next({
      id: '00000000-0000-0000-0000-000000000010',
      name: 'TAI Admin',
      email: 'admin@tai.com',
      roles: ['Admin'],
      privileges: ['Portal.Users.Read'],
      rawClaims: {
        sub: '00000000-0000-0000-0000-000000000010',
        email: 'admin@tai.com',
        role: ['Admin'],
      },
    });
    await configure();

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(authService.checkAuth).toHaveBeenCalledOnce();
    expect(compiled.textContent).toContain('TAI Admin');
    expect(compiled.textContent).toContain('admin@tai.com');
    expect(compiled.textContent).toContain('Portal.Users.Read');
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
  });

  async function configure(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [App, RouterTestingModule],
      providers: [
        { provide: SecurityLoggerService, useValue: loggerSpy },
        { provide: BorrowerAuthService, useValue: authService },
      ],
    }).compileComponents();
  }
});
```

- [ ] **Step 2: Run app tests and verify they fail**

Run:

```bash
npx nx test borrower-portal --testFile=apps/borrower-portal/src/app/app.spec.ts
```

Expected: FAIL because the app does not expose sign-in UI or auth service bindings yet.

- [ ] **Step 3: Update the app component class**

Replace `apps/borrower-portal/src/app/app.ts` with:

```typescript
import { AsyncPipe, JsonPipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BorrowerAuthService } from './auth/borrower-auth.service';
import { CryptoStorageService } from './claim/services/crypto-storage.service';
import { SecurityLoggerService } from './claim/services/security-logger.service';
import { CryptoUnavailableComponent } from '@tai/ui-design-system';

@Component({
  imports: [RouterModule, CryptoUnavailableComponent, AsyncPipe, JsonPipe],
  selector: 'bp-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly auth = inject(BorrowerAuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly logger = inject(SecurityLoggerService);

  protected title = 'borrower-portal';
  protected cryptoAvailable = signal(CryptoStorageService.isAvailable());
  protected user$ = this.auth.user$;

  constructor() {
    if (!this.cryptoAvailable()) {
      this.logger.log(
        'CRYPTO_UNAVAILABLE',
        'crypto.subtle unavailable - application gated behind CryptoUnavailableComponent',
      );
      return;
    }

    this.auth.checkAuth().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  protected login(): void {
    this.auth.login();
  }

  protected logout(): void {
    this.auth.logout();
  }
}
```

- [ ] **Step 4: Update the app template**

Replace `apps/borrower-portal/src/app/app.html` with:

```html
@if (cryptoAvailable()) {
  @if (user$ | async; as user) {
    <main class="borrower-shell" data-testid="borrower-authenticated-shell">
      <header class="borrower-shell__header">
        <div>
          <p class="borrower-shell__eyebrow">Borrower Portal</p>
          <h1>Disability Claim</h1>
          <p class="borrower-shell__identity">
            Signed in as <strong>{{ user.name }}</strong> · {{ user.email }}
          </p>
        </div>
        <button type="button" class="borrower-shell__logout" (click)="logout()">
          Sign out
        </button>
      </header>

      <section class="borrower-shell__claims" aria-label="Signed-in user claims">
        <div>
          <span class="borrower-shell__label">Roles</span>
          <p>{{ user.roles.length ? user.roles.join(', ') : 'None' }}</p>
        </div>
        <div>
          <span class="borrower-shell__label">Privileges</span>
          <p>{{ user.privileges.length ? user.privileges.join(', ') : 'None' }}</p>
        </div>
        <details>
          <summary>Raw identity claims</summary>
          <pre>{{ user.rawClaims | json }}</pre>
        </details>
      </section>

      <router-outlet></router-outlet>
    </main>
  } @else {
    <main class="borrower-sign-in" data-testid="borrower-sign-in">
      <section class="borrower-sign-in__panel">
        <p class="borrower-shell__eyebrow">Borrower Portal</p>
        <h1>Sign in to continue</h1>
        <p>
          Use Portal Identity to access your disability claim workspace.
        </p>
        <button
          type="button"
          class="borrower-sign-in__button"
          data-testid="borrower-sign-in-button"
          (click)="login()"
        >
          Sign in with Portal Identity
        </button>
      </section>
    </main>
  }
} @else {
  <tai-crypto-unavailable></tai-crypto-unavailable>
}
```

- [ ] **Step 5: Add app shell styles**

Replace `apps/borrower-portal/src/app/app.scss` with:

```scss
:host {
  display: block;
  min-height: 100vh;
  background: #f6f8fb;
  color: #172033;
}

.borrower-shell {
  min-height: 100vh;
}

.borrower-shell__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #d9e1ef;
  background: #ffffff;
}

.borrower-shell__header h1,
.borrower-sign-in__panel h1 {
  margin: 0;
  font-size: 1.5rem;
  line-height: 1.2;
}

.borrower-shell__eyebrow {
  margin: 0 0 0.25rem;
  color: #4f627d;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

.borrower-shell__identity {
  margin: 0.35rem 0 0;
  color: #4f627d;
  font-size: 0.9rem;
}

.borrower-shell__logout,
.borrower-sign-in__button {
  min-height: 2.5rem;
  border: 0;
  border-radius: 0.375rem;
  background: #155eef;
  color: #ffffff;
  cursor: pointer;
  font-weight: 700;
  padding: 0 1rem;
}

.borrower-shell__logout:hover,
.borrower-sign-in__button:hover {
  background: #0f49bd;
}

.borrower-shell__claims {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #d9e1ef;
  background: #ffffff;
}

.borrower-shell__claims p {
  margin: 0.25rem 0 0;
  overflow-wrap: anywhere;
}

.borrower-shell__label {
  color: #4f627d;
  font-size: 0.75rem;
  font-weight: 700;
}

.borrower-shell__claims details {
  min-width: 0;
}

.borrower-shell__claims pre {
  max-height: 10rem;
  overflow: auto;
  padding: 0.75rem;
  border-radius: 0.375rem;
  background: #101828;
  color: #f8fafc;
  font-size: 0.75rem;
  white-space: pre-wrap;
}

.borrower-sign-in {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 1.5rem;
}

.borrower-sign-in__panel {
  width: min(100%, 28rem);
  padding: 2rem;
  border: 1px solid #d9e1ef;
  border-radius: 0.5rem;
  background: #ffffff;
  box-shadow: 0 1rem 2.5rem rgb(23 32 51 / 10%);
}

.borrower-sign-in__panel p:not(.borrower-shell__eyebrow) {
  margin: 0.75rem 0 1.5rem;
  color: #4f627d;
}

@media (max-width: 760px) {
  .borrower-shell__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .borrower-shell__claims {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 6: Run app tests and verify they pass**

Run:

```bash
npx nx test borrower-portal --testFile=apps/borrower-portal/src/app/app.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Run the full borrower portal test suite**

Run:

```bash
npx nx test borrower-portal
```

Expected: PASS.

- [ ] **Step 8: Commit Task 3 and Task 4 together**

```bash
git add apps/borrower-portal/src/app/app.config.ts apps/borrower-portal/src/app/app.ts apps/borrower-portal/src/app/app.html apps/borrower-portal/src/app/app.scss apps/borrower-portal/src/app/app.spec.ts
git commit -m "feat: add borrower portal identity sign in"
```

---

### Task 5: Manual Sign-In Verification

**Files:**
- No source changes expected.

- [ ] **Step 1: Start required local services**

Run the existing project startup path used for Portal Identity. If using Nx directly, start these in separate terminals:

```bash
npx nx serve portal-api
npx nx serve identity-ui
npx nx serve borrower-portal
```

Expected:
- Portal API/gateway identity endpoints are reachable at `http://localhost:5217/identity/...`.
- Identity UI is reachable at `http://localhost:4300`.
- Borrower Portal is reachable at `http://localhost:4202`.

- [ ] **Step 2: Verify unauthenticated borrower portal state**

Open:

```text
http://localhost:4202
```

Expected:
- The app shows `Sign in to continue`.
- The claim wizard is not visible.
- The button text is `Sign in with Portal Identity`.

- [ ] **Step 3: Verify redirect to Identity UI**

Click `Sign in with Portal Identity`.

Expected:
- Browser navigates through the OpenIddict authorization endpoint.
- Identity UI shows the login form.
- The login form has a `returnUrl` that points back into the OIDC flow.

- [ ] **Step 4: Sign in with seeded credentials**

Use:

```text
Email: admin@tai.com
Password: Password123!
```

Expected:
- Identity UI posts to the backend login endpoint.
- Browser returns to `http://localhost:4202`.
- Borrower Portal shows `TAI Admin`, `admin@tai.com`, roles, privileges, and raw identity claims.
- The claim wizard is visible below the authenticated shell.

- [ ] **Step 5: Verify logout**

Click `Sign out`.

Expected:
- The OIDC logout flow runs.
- Browser returns to Borrower Portal.
- The unauthenticated sign-in panel is visible again.

---

### Task 6: Regression Verification

**Files:**
- No source changes expected.

- [ ] **Step 1: Run affected frontend tests**

Run:

```bash
npx nx test borrower-portal
npx nx test docviewer-mock
```

Expected: PASS.

- [ ] **Step 2: Run affected backend integration tests**

Run:

```bash
npx nx test portal-api.integration-tests --testNamePattern=Oidc
```

Expected: PASS.

- [ ] **Step 3: Build affected apps**

Run:

```bash
npx nx build borrower-portal --configuration=development
npx nx build identity-ui --configuration=development
```

Expected: PASS.

- [ ] **Step 4: Final status check**

Run:

```bash
git status --short
```

Expected: clean working tree after commits, or only unrelated pre-existing files.

---

## Follow-Up Plan Boundaries

Do not fold these into this implementation:

- Replacing `borrower-portal-api` `X-User-Id` middleware with bearer-token validation.
- Loading disability claim records from authenticated user identity.
- Creating authoritative submitted claim snapshots.
- DocuSign signing-session, webhook, or document storage work.

Those should be separate plans because they touch backend auth, payment-protection persistence, and the signing lifecycle.

## Self-Review

- Spec coverage: The plan covers sign-in button, redirect to Identity UI, redirect back to Borrower Portal, user display, raw OIDC claims display, and DocViewer-style OIDC reuse.
- Placeholder scan: No unresolved marker text or deferred implementation placeholders remain.
- Type consistency: `BorrowerUser`, `BorrowerAuthService`, and app template names match across tasks.
- Scope check: The plan is a single frontend identity integration slice plus the required OpenIddict redirect registration.
