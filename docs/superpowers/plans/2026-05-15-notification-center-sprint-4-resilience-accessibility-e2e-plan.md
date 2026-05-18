# Notification Center Sprint 4 Resilience, Accessibility, and E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver resilient reconnect recovery, accessible notification-panel keyboard behavior, production-gated E2E hooks, and end-to-end coverage for the notification center.

**Architecture:** Keep `RealTimeService` SignalR-only. `App` adapts SignalR connection state to a UI-local panel state, owns the build-gated test hook, and triggers rehydration through `NotificationHistoryService.forceRetry()`. The design-system panel remains app-store agnostic and receives plain inputs for connection state, hydration state, retry state, and recovery notices.

**Tech Stack:** Angular standalone components, Angular signals, RxJS, `@angular/cdk/a11y`, Vitest, Nx, Playwright, ASP.NET Core integration tests.

---

## Implementation Notes

- Spec: `docs/superpowers/specs/2026-05-13-notification-center-sprint-4-resilience-accessibility-e2e-design.md`.
- The reviewed design has passed panel review in `docs/superpowers/specs/reviews/sprint-4-panel-review-report-r6-greenlight.md`.
- Do not make `RealTimeService` inject or import `NotificationHistoryService`.
- Do not make design-system components import portal-web services, stores, SignalR types, or environment files.
- Do not use Angular signal `effect()` for reconnect rehydration. Use the RxJS transition stream in this plan.
- The UI-local connection type is `NotificationPanelConnectionState = 'connected' | 'reconnecting' | 'disconnected'`.
- Build-gated hook name is exactly `window.__testConnectionStateOverride__`.
- Production builds must not contain `__testConnectionStateOverride__`.
- The test hook intentionally drives the same App connection state used by the reconnect subscription. In test builds, setting `Reconnecting` then `Connected` is allowed to trigger a real `/api/AuditLogs/recent` rehydration request; the E2E resilience tests depend on that behavior.
- The test hook accepts either `HubConnectionState` enum values or enum member names such as `'Disconnected'`, `'Reconnecting'`, and `'Connected'`. It rejects any other string or number without changing state.
- Retry signal priority: `forceRetryNotice` is a recovery status and may be visible at the same time as `isRetryThrottled`; when both are active, show the recovery notice and keep one Retry button visible with the helper text `Try again shortly.` Do not render duplicate Retry buttons.
- E2E auth state: `apps/portal-web-e2e/src/auth.setup.ts` creates `apps/portal-web-e2e/.auth/acme-session.json`; Sprint 4 E2E specs should continue using `injectAuthSession(page, 'acme-session.json')`.
- CI placement: add the production hook grep check to the existing `ci` job in `.github/workflows/main.yml`, immediately after `Build Affected`. It should run an explicit `portal-web` production build every time the `ci` job runs, not only when Nx marks portal-web affected.
- Tenant context for `/api/AuditLogs/recent` is host-based through `TenantResolutionMiddleware`; tests must assert host-scoped rows and ignored browser-supplied tenant/bypass headers.
- Connected banner is persistent only when visible. Suppress it for healthy empty states.
- Error/recovery notices suppress reconnecting/disconnected panel banners while they are visible.
- Keep notification content as Angular interpolation/text bindings. Do not use `[innerHTML]`.
- Frequent commits are expected after each task.

## Panel Review R1 Response

Critical findings:

1. E2E hook argument type mismatch: fixed by making `window.__testConnectionStateOverride__` accept both `HubConnectionState` enum values and enum member names. The E2E tests can keep readable string calls like `'Disconnected'` and invalid names are rejected.
2. Backend fixture class missing: fixed by replacing the custom fixture reference with the repo's existing `WebApplicationFactory<Program>` pattern.
3. Backend test auth headers unrecognized: fixed by using `TestAuthHandler` and `TestUserContext` through `ConfigureTestServices`, matching existing integration tests.
4. Roving tabindex starts with no tabbable item: fixed by adding `firstVisibleNotificationId()` and `rovingNotificationId()` so the first visible notification has `tabindex="0"` by default.
5. Production grep path mismatch: fixed by targeting `dist/apps/portal-web/browser` in all production/test hook grep commands.

Question decisions:

1. Hook behavior: acceptable and intentional for the test hook to trigger real rehydration API calls in test builds. The resilience E2E test verifies the real reconnect recovery path.
2. Signal priority: `forceRetryNotice` and `isRetryThrottled` may be active simultaneously. Render one recovery/error notice and one Retry button; when normal retry is throttled, the button remains focusable with `aria-disabled` and helper copy.
3. E2E auth file: use `acme-session.json`. `apps/portal-web-e2e/src/auth.setup.ts` writes it before dependent specs run.
4. CI placement: add the explicit production build and grep check to the existing `ci` job immediately after `Build Affected`; run it every CI pass, not only when `portal-web` is affected. Update the `e2e` job service startup to serve `portal-web` with `--configuration=test`.

## Panel Review R2 Response

Critical finding:

1. Task 7 app.html overwrite risk: fixed by making Task 7 preserve the full `tai-notification-panel` block from Task 3 and by showing the merged `app.html` notification toggle + panel section.

Significant findings incorporated:

- Mark All Read focus destination: Task 6 now specifies `onMarkAllRead()` focus movement to the first visible notification or close button.
- Focus trap and close focus verification: Task 8 now includes Tab containment plus close-button and overlay-click focus restoration checks.
- Focus mutation clamp: Task 6 now adds a `resolveFocusAfterMutation()` decision tree with previous-index fallback.
- Scroll preservation: Task 6 now adds `preserveScrollDuringPrepend()` using `afterNextRender()`.
- Force retry auth boundary: Task 2 now includes a missing-user-context skip test.
- Backend negative auth tests: Task 4 now includes unauthenticated, non-admin, and wrong-gateway-secret cases.
- Simultaneous recovery/throttle state: Task 5 now includes a panel unit test for one visible Retry button, recovery copy, helper text, and `aria-disabled`.
- Search-to-empty transition: Task 5 now adds `wasSearchMatchBeforeHydrate` state and search-specific empty copy.
- Skeleton timing: Task 5 now adds 300ms threshold/min-display timer requirements.
- Project config merge guidance: Task 1 now shows merged `project.json` configuration snippets preserving existing production and development options.
- File replacement verification: Task 1 and Task 10 now grep production/test bundles for expected `enableE2eConnectionHook` values.
- Rollback documentation: added a rollback section before full verification.
- Force retry observability: accepted as POC scope; Task 2 keeps non-sensitive browser `console.warn`, and post-Sprint 4 telemetry remains deferred.

Question decisions:

1. Skeleton timing is blocking for Sprint 4 UX quality because the spec requires the 300ms threshold and min-display behavior.
2. Search-to-empty transition is blocking for this plan because the approved spec requires the `wasSearchMatchBeforeHydrate` behavior and user-facing copy.

## File Structure

Create:

- `apps/portal-web/src/environments/environment.ts`
- `apps/portal-web/src/environments/environment.development.ts`
- `apps/portal-web/src/environments/environment.test.ts`
- `apps/portal-web/src/environments/environment.prod.ts`
- `apps/portal-web-e2e/src/notifications-resilience.spec.ts`
- `apps/portal-web-e2e/src/notifications-edge-states.spec.ts`
- `apps/portal-web-e2e/src/notifications-accessibility.spec.ts`
- `apps/portal-web-e2e/playwright.config.ts`
- `apps/portal-api.integration-tests/AuditLogsRecentAuthorizationTests.cs`

Modify:

- `apps/portal-web/project.json`
- `apps/portal-web/src/app/app.ts`
- `apps/portal-web/src/app/app.html`
- `apps/portal-web/src/app/app.spec.ts`
- `apps/portal-web/src/app/notifications/notification-history.service.ts`
- `apps/portal-web/src/app/notifications/notification-history.service.spec.ts`
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.types.ts`
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.ts`
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.html`
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.scss`
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.spec.ts`
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.stories.ts`
- `libs/ui/design-system/src/lib/molecules/notification-toggle/notification-toggle.component.ts`
- `libs/ui/design-system/src/lib/molecules/notification-toggle/notification-toggle.component.html`
- `libs/ui/design-system/src/lib/molecules/notification-toggle/notification-toggle.component.scss`
- `libs/ui/design-system/src/lib/molecules/notification-toggle/notification-toggle.spec.ts`
- `libs/ui/design-system/src/lib/molecules/notification-toggle/notification-toggle.stories.ts`
- `.github/workflows/main.yml`

Verification commands:

```bash
CI=true npx nx test portal-web --skip-nx-cache
CI=true npx nx test design-system --skip-nx-cache
dotnet test apps/portal-api.integration-tests/portal-api.integration-tests.csproj
CI=true npx nx lint portal-web --skip-nx-cache
CI=true npx nx lint design-system --skip-nx-cache
CI=true npx nx build portal-web --configuration=production --skip-nx-cache
if rg "__testConnectionStateOverride__" dist/apps/portal-web/browser; then exit 1; fi
CI=true npx nx build portal-web --configuration=test --skip-nx-cache
rg "__testConnectionStateOverride__" dist/apps/portal-web/browser
CI=true npx nx build-storybook design-system --skip-nx-cache
CI=true npx nx e2e portal-web-e2e --skip-nx-cache
```

---

### Task 1: Angular Environment Build Gate

**Files:**
- Create: `apps/portal-web/src/environments/environment.ts`
- Create: `apps/portal-web/src/environments/environment.development.ts`
- Create: `apps/portal-web/src/environments/environment.test.ts`
- Create: `apps/portal-web/src/environments/environment.prod.ts`
- Modify: `apps/portal-web/project.json`

- [ ] **Step 1: Add environment files**

Create `apps/portal-web/src/environments/environment.ts`:

```typescript
export const environment = {
  enableE2eConnectionHook: false,
} as const;
```

Create `apps/portal-web/src/environments/environment.development.ts`:

```typescript
export const environment = {
  enableE2eConnectionHook: false,
} as const;
```

Create `apps/portal-web/src/environments/environment.test.ts`:

```typescript
export const environment = {
  enableE2eConnectionHook: true,
} as const;
```

Create `apps/portal-web/src/environments/environment.prod.ts`:

```typescript
export const environment = {
  enableE2eConnectionHook: false,
} as const;
```

- [ ] **Step 2: Add Angular file replacements**

Modify `apps/portal-web/project.json`. Preserve the current `production` optimization, budgets, and `outputHashing` values, and preserve the current `development` optimization, `extractLicenses`, and `sourceMap` values. The merged build configurations must have this shape:

```json
"configurations": {
  "production": {
    "optimization": {
      "scripts": true,
      "styles": {
        "minify": true,
        "inlineCritical": false
      },
      "fonts": true
    },
    "budgets": [
      {
        "type": "initial",
        "maximumWarning": "500kb",
        "maximumError": "1mb"
      },
      {
        "type": "anyComponentStyle",
        "maximumWarning": "4kb",
        "maximumError": "8kb"
      }
    ],
    "outputHashing": "all",
    "fileReplacements": [
      {
        "replace": "apps/portal-web/src/environments/environment.ts",
        "with": "apps/portal-web/src/environments/environment.prod.ts"
      }
    ]
  },
  "development": {
    "optimization": false,
    "extractLicenses": false,
    "sourceMap": true,
    "fileReplacements": [
      {
        "replace": "apps/portal-web/src/environments/environment.ts",
        "with": "apps/portal-web/src/environments/environment.development.ts"
      }
    ]
  },
  "test": {
    "optimization": false,
    "extractLicenses": false,
    "sourceMap": true,
    "fileReplacements": [
      {
        "replace": "apps/portal-web/src/environments/environment.ts",
        "with": "apps/portal-web/src/environments/environment.test.ts"
      }
    ]
  }
}
```

Do not remove existing `build.options`, `defaultConfiguration`, `build-tailwind`, or other targets.

- [ ] **Step 3: Add test serve target**

Modify `apps/portal-web/project.json` so `serve.configurations.test` points to the test build:

```json
"test": {
  "buildTarget": "portal-web:build:test"
}
```

- [ ] **Step 4: Verify environment build targets**

Run:

```bash
CI=true npx nx build portal-web --configuration=production --skip-nx-cache
rg "enableE2eConnectionHook: false|enableE2eConnectionHook\\\":false" dist/apps/portal-web/browser || true
CI=true npx nx build portal-web --configuration=test --skip-nx-cache
rg "enableE2eConnectionHook: true|enableE2eConnectionHook\\\":true" dist/apps/portal-web/browser || true
```

Expected: both builds exit 0. The environment-value grep commands are diagnostic because esbuild may inline or optimize the object away; if they find values, they must match the requested configuration. The later production hook grep is the required safety check.

- [ ] **Step 5: Commit**

```bash
git add apps/portal-web/project.json apps/portal-web/src/environments
git commit -m "build: add notification e2e environment gate"
```

---

### Task 2: Notification History Force Retry API

**Files:**
- Modify: `apps/portal-web/src/app/notifications/notification-history.service.ts`
- Modify: `apps/portal-web/src/app/notifications/notification-history.service.spec.ts`

- [ ] **Step 1: Write failing force-retry tests**

Add tests to `apps/portal-web/src/app/notifications/notification-history.service.spec.ts`:

```typescript
it('forceRetry skips when hydration is already in flight', () => {
  store.setHydrating(true);
  service.forceRetry();
  expect(httpMock.match('/api/AuditLogs/recent?limit=50')).toHaveLength(0);
});

it('forceRetry skips when user context is missing', () => {
  authUserSubject.next(null);
  service.forceRetry();
  expect(httpMock.match('/api/AuditLogs/recent?limit=50')).toHaveLength(0);
});

it('forceRetry allows at most 10 attempts per tenant user in 60 seconds', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'));

  for (let i = 0; i < 10; i += 1) {
    service.forceRetry();
    httpMock.expectOne('/api/AuditLogs/recent?limit=50').flush([]);
  }

  service.forceRetry();
  expect(httpMock.match('/api/AuditLogs/recent?limit=50')).toHaveLength(0);
  expect(service.forceRetryNotice()).toBe('Updates paused briefly. Cached notifications are still available.');

  vi.setSystemTime(new Date('2026-05-15T12:01:01.000Z'));
  service.forceRetry();
  httpMock.expectOne('/api/AuditLogs/recent?limit=50').flush([]);
  expect(service.forceRetryNotice()).toBeNull();

  vi.useRealTimers();
});

it('normal retry remains governed by isRetryThrottled when force retry is paused', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'));

  for (let i = 0; i < 10; i += 1) {
    service.forceRetry();
    httpMock.expectOne('/api/AuditLogs/recent?limit=50').flush([]);
  }

  service.forceRetry();
  expect(service.forceRetryNotice()).toBe('Updates paused briefly. Cached notifications are still available.');
  expect(service.isRetryThrottled()).toBe(false);

  service.retry();
  vi.advanceTimersByTime(1000);
  httpMock.expectOne('/api/AuditLogs/recent?limit=50').flush([]);

  vi.useRealTimers();
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
CI=true npx nx test portal-web --testFile=notification-history.service.spec.ts --skip-nx-cache
```

Expected: FAIL because `forceRetry`, `isRetryThrottled`, and `forceRetryNotice` are not implemented.

- [ ] **Step 3: Implement force retry state**

Modify `apps/portal-web/src/app/notifications/notification-history.service.ts`:

```typescript
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

const FORCE_RETRY_WINDOW_MS = 60_000;
const MAX_FORCE_RETRIES_PER_WINDOW = 10;
const FORCE_RETRY_NOTICE = 'Updates paused briefly. Cached notifications are still available.';
```

Add fields:

```typescript
private readonly forceRetryAttemptsByTenant = new Map<string, number[]>();
private readonly forceRetryPausedUntilSignal = signal<number | null>(null);
private readonly forceRetryNoticeSignal = signal<string | null>(null);
private readonly retryThrottledUntilSignal = signal<number | null>(null);

readonly forceRetryPausedUntil = this.forceRetryPausedUntilSignal.asReadonly();
readonly forceRetryNotice = this.forceRetryNoticeSignal.asReadonly();
readonly isRetryThrottled = computed(() => {
  const retryUntil = this.retryThrottledUntilSignal();
  return retryUntil !== null && Date.now() < retryUntil;
});
```

Add methods:

```typescript
forceRetry(): void {
  const user = this.currentUser;
  if (!user?.tenantId || !user.id || this.store.isHydrating()) {
    return;
  }

  const hydrationKey = this.getHydrationKey({ tenantId: user.tenantId, id: user.id });
  if (!this.canForceRetry(hydrationKey)) {
    console.warn('Notification reconnect recovery paused after force retry limit.');
    this.forceRetryNoticeSignal.set(FORCE_RETRY_NOTICE);
    return;
  }

  this.hydratedTenants.delete(hydrationKey);
  this.hydrateTenant(user.tenantId, user.id).subscribe();
}

private canForceRetry(hydrationKey: string): boolean {
  const now = Date.now();
  const attempts = (this.forceRetryAttemptsByTenant.get(hydrationKey) ?? [])
    .filter(timestamp => now - timestamp < FORCE_RETRY_WINDOW_MS);

  if (attempts.length >= MAX_FORCE_RETRIES_PER_WINDOW) {
    this.forceRetryAttemptsByTenant.set(hydrationKey, attempts);
    this.forceRetryPausedUntilSignal.set(attempts[0] + FORCE_RETRY_WINDOW_MS);
    return false;
  }

  attempts.push(now);
  this.forceRetryAttemptsByTenant.set(hydrationKey, attempts);
  this.forceRetryPausedUntilSignal.set(null);
  this.forceRetryNoticeSignal.set(null);
  return true;
}
```

The `console.warn` is intentionally non-sensitive and browser-local for the Sprint 4 POC. Do not log tenant IDs, user IDs, event IDs, request URLs, or raw errors. Operational telemetry for repeated force-retry exhaustion is deferred to post-Sprint 4 hardening.

- [ ] **Step 4: Clear counters in the right places**

In `handleAuthBoundary`, clear both maps when the auth scope changes:

```typescript
if (previousKey !== nextKey) {
  this.retryAttemptsByTenant.clear();
  this.forceRetryAttemptsByTenant.clear();
  this.retryThrottledUntilSignal.set(null);
  this.forceRetryPausedUntilSignal.set(null);
  this.forceRetryNoticeSignal.set(null);
}
```

In `applyHydrationRows`, after `this.store.addNotifications(mapped);` and before `this.store.markHydrated();`, clear counters for the current key:

```typescript
const hydrationKey = this.getHydrationKey({ tenantId: expectedTenantId, id: expectedUserId });
this.retryAttemptsByTenant.delete(hydrationKey);
this.forceRetryAttemptsByTenant.delete(hydrationKey);
this.retryThrottledUntilSignal.set(null);
this.forceRetryPausedUntilSignal.set(null);
this.forceRetryNoticeSignal.set(null);
```

In `canRetry`, set the retry throttled signal when the normal retry limit is hit:

```typescript
if (attempts.length >= MAX_RETRIES_PER_WINDOW) {
  this.retryAttemptsByTenant.set(tenantId, attempts);
  this.retryThrottledUntilSignal.set(attempts[0] + RETRY_WINDOW_MS);
  return false;
}
```

- [ ] **Step 5: Run notification history tests**

Run:

```bash
CI=true npx nx test portal-web --testFile=notification-history.service.spec.ts --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/portal-web/src/app/notifications/notification-history.service.ts apps/portal-web/src/app/notifications/notification-history.service.spec.ts
git commit -m "feat: add notification reconnect force retry"
```

---

### Task 3: App Connection Adapter and Test Hook

**Files:**
- Modify: `apps/portal-web/src/app/app.ts`
- Modify: `apps/portal-web/src/app/app.html`
- Modify: `apps/portal-web/src/app/app.spec.ts`

- [ ] **Step 1: Write failing App reconnect tests**

Add tests to `apps/portal-web/src/app/app.spec.ts`:

```typescript
it('maps SignalR connection states to notification panel states', () => {
  expect(mapToNotificationPanelConnectionState(HubConnectionState.Connected)).toBe('connected');
  expect(mapToNotificationPanelConnectionState(HubConnectionState.Connecting)).toBe('reconnecting');
  expect(mapToNotificationPanelConnectionState(HubConnectionState.Reconnecting)).toBe('reconnecting');
  expect(mapToNotificationPanelConnectionState(HubConnectionState.Disconnecting)).toBe('reconnecting');
  expect(mapToNotificationPanelConnectionState(HubConnectionState.Disconnected)).toBe('disconnected');
});

it('calls forceRetry once for rapid reconnect recoveries', fakeAsync(() => {
  connectionStatusSubject.next(HubConnectionState.Reconnecting);
  connectionStatusSubject.next(HubConnectionState.Connected);
  connectionStatusSubject.next(HubConnectionState.Reconnecting);
  connectionStatusSubject.next(HubConnectionState.Connected);
  tick(500);
  expect(notificationHistoryService.forceRetry).toHaveBeenCalledTimes(1);
}));

it('does not call forceRetry if state disconnects during debounce window', fakeAsync(() => {
  connectionStatusSubject.next(HubConnectionState.Reconnecting);
  connectionStatusSubject.next(HubConnectionState.Connected);
  connectionStatusSubject.next(HubConnectionState.Disconnected);
  tick(500);
  expect(notificationHistoryService.forceRetry).not.toHaveBeenCalled();
}));

it('test hook accepts enum member names and rejects invalid names', () => {
  window.__testConnectionStateOverride__('Disconnected');
  expect(component.connectionStateForTest()).toBe(HubConnectionState.Disconnected);

  window.__testConnectionStateOverride__('Connected');
  expect(component.connectionStateForTest()).toBe(HubConnectionState.Connected);

  window.__testConnectionStateOverride__('InvalidState' as never);
  expect(component.connectionStateForTest()).toBe(HubConnectionState.Connected);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
CI=true npx nx test portal-web --testFile=app.spec.ts --skip-nx-cache
```

Expected: FAIL because mapping, hook, and reconnect stream do not exist.

- [ ] **Step 3: Add connection adapter code**

Modify `apps/portal-web/src/app/app.ts`:

```typescript
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { HubConnectionState } from '@microsoft/signalr';
import { debounceTime, distinctUntilChanged, filter, pairwise, withLatestFrom } from 'rxjs/operators';
import { environment } from '../environments/environment';
import { NotificationPanelConnectionState } from '@tai/ui-design-system';

declare global {
  interface Window {
    __testConnectionStateOverride__?: (state: HubConnectionState | keyof typeof HubConnectionState) => void;
  }
}

export function mapToNotificationPanelConnectionState(state: HubConnectionState): NotificationPanelConnectionState {
  switch (state) {
    case HubConnectionState.Connected:
      return 'connected';
    case HubConnectionState.Connecting:
    case HubConnectionState.Reconnecting:
    case HubConnectionState.Disconnecting:
      return 'reconnecting';
    case HubConnectionState.Disconnected:
    default:
      return 'disconnected';
  }
}

function coerceHubConnectionState(state: HubConnectionState | keyof typeof HubConnectionState): HubConnectionState | null {
  if (typeof state === 'number' && Object.values(HubConnectionState).includes(state)) {
    return state;
  }

  if (typeof state === 'string' && Object.prototype.hasOwnProperty.call(HubConnectionState, state)) {
    return HubConnectionState[state as keyof typeof HubConnectionState] as HubConnectionState;
  }

  return null;
}
```

Add fields to `App`:

```typescript
private readonly connectionStatus$ = this.realTimeService.connectionStatus$;
private readonly realTimeConnectionState = toSignal(this.connectionStatus$, {
  initialValue: HubConnectionState.Disconnected,
});
private readonly connectionStateOverride = signal<HubConnectionState | null>(null);
private readonly reconnectDebounceMs = 500;

protected readonly connectionState = computed(() =>
  this.connectionStateOverride() ?? this.realTimeConnectionState()
);

private readonly observedConnectionState$ = toObservable(this.connectionState);

protected readonly notificationPanelConnectionState = computed(() =>
  mapToNotificationPanelConnectionState(this.connectionState())
);

connectionStateForTest(): HubConnectionState {
  return this.connectionState();
}
```

In the constructor:

```typescript
constructor() {
  if (environment.enableE2eConnectionHook) {
    this.installConnectionStateTestHook();
  }

  this.observedConnectionState$.pipe(
    distinctUntilChanged(),
    pairwise(),
    filter(([previous, current]) =>
      previous === HubConnectionState.Reconnecting && current === HubConnectionState.Connected
    ),
    debounceTime(this.reconnectDebounceMs),
    withLatestFrom(this.observedConnectionState$),
    filter(([, current]) => current === HubConnectionState.Connected),
    takeUntilDestroyed(this.destroyRef),
  ).subscribe(() => this.notificationHistoryService.forceRetry());
}
```

Add the hook method:

```typescript
private installConnectionStateTestHook(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.__testConnectionStateOverride__ = (state: HubConnectionState | keyof typeof HubConnectionState) => {
    const nextState = coerceHubConnectionState(state);
    if (nextState === null) {
      return;
    }
    this.connectionStateOverride.set(nextState);
  };
}
```

- [ ] **Step 4: Wire panel inputs**

Modify `apps/portal-web/src/app/app.html`:

```html
<tai-notification-panel
  [notifications]="notificationPanelItems()"
  [isLoading]="notificationStore.isHydrating()"
  [hasHydrated]="notificationStore.hasHydrated()"
  [error]="notificationStore.hydrationError()"
  [connectionState]="notificationPanelConnectionState()"
  [isRetryThrottled]="notificationHistoryService.isRetryThrottled()"
  [recoveryNotice]="notificationHistoryService.forceRetryNotice()"
  (retry)="notificationHistoryService.retry()"
  (markRead)="markNotificationRead($event)"
  (markAllRead)="markAllNotificationsRead()"
  (acknowledge)="acknowledgeNotification($event)">
</tai-notification-panel>
```

- [ ] **Step 5: Run App tests**

Run:

```bash
CI=true npx nx test portal-web --testFile=app.spec.ts --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 6: Verify hook build gating**

Run:

```bash
CI=true npx nx build portal-web --configuration=production --skip-nx-cache
if rg "__testConnectionStateOverride__" dist/apps/portal-web/browser; then exit 1; fi
CI=true npx nx build portal-web --configuration=test --skip-nx-cache
rg "__testConnectionStateOverride__" dist/apps/portal-web/browser
```

Expected: production grep exits 1 inside the `if` and the script exits 0; test grep finds the hook.

- [ ] **Step 7: Commit**

```bash
git add apps/portal-web/src/app/app.ts apps/portal-web/src/app/app.html apps/portal-web/src/app/app.spec.ts
git commit -m "feat: connect notification panel to realtime state"
```

---

### Task 4: Backend Recent Audit Authorization Tests

**Files:**
- Create: `apps/portal-api.integration-tests/AuditLogsRecentAuthorizationTests.cs`

- [ ] **Step 1: Write host-scoped authorization tests**

Create `apps/portal-api.integration-tests/AuditLogsRecentAuthorizationTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Infrastructure.Persistence;
using Xunit;

namespace Tai.Portal.Api.IntegrationTests;

public class AuditLogsRecentAuthorizationTests : IClassFixture<WebApplicationFactory<Program>> {
  private static readonly TenantId TaiTenantId = new(Guid.Parse("00000000-0000-0000-0000-000000000001"));
  private static readonly TenantId AcmeTenantId = new(Guid.Parse("00000000-0000-0000-0000-000000000002"));
  private const string AdminUserId = "00000000-0000-0000-0000-000000000010";
  private readonly WebApplicationFactory<Program> _factory;
  private readonly string _gatewaySecret;

  public AuditLogsRecentAuthorizationTests(WebApplicationFactory<Program> factory) {
    _factory = factory;
    var config = _factory.Services.GetRequiredService<IConfiguration>();
    _gatewaySecret = config["GATEWAY_SECRET"] ?? config["Gateway:Secret"] ?? "portal-poc-secret-2026";
    _ = _factory.Server;
  }

  [Fact]
  public async Task Recent_ReturnsOnlyCurrentHostTenantAuditLogs() {
    var taiCorrelationId = $"tai-{Guid.NewGuid()}";
    var acmeCorrelationId = $"acme-{Guid.NewGuid()}";
    var factory = CreateFactoryWithMockAuth(AdminUserId, new[] { "Admin" });
    await SeedAuditLogs(factory, taiCorrelationId, acmeCorrelationId);

    var client = CreateAdminClient(factory, "http://localhost/");
    var response = await client.GetAsync("/api/AuditLogs/recent?limit=50");

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    var rows = await response.Content.ReadFromJsonAsync<List<RecentAuditLogResponse>>();
    Assert.NotNull(rows);
    Assert.Contains(rows, row => row.CorrelationId == taiCorrelationId);
    Assert.DoesNotContain(rows, row => row.CorrelationId == acmeCorrelationId);
    Assert.All(rows, row => Assert.Equal(TaiTenantId.Value, row.TenantId));
  }

  [Fact]
  public async Task Recent_ReturnsOnlyAcmeHostTenantAuditLogs() {
    var taiCorrelationId = $"tai-{Guid.NewGuid()}";
    var acmeCorrelationId = $"acme-{Guid.NewGuid()}";
    var factory = CreateFactoryWithMockAuth(AdminUserId, new[] { "Admin" });
    await SeedAuditLogs(factory, taiCorrelationId, acmeCorrelationId);

    var client = CreateAdminClient(factory, "http://acme.localhost/");
    var response = await client.GetAsync("/api/AuditLogs/recent?limit=50");

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    var rows = await response.Content.ReadFromJsonAsync<List<RecentAuditLogResponse>>();
    Assert.NotNull(rows);
    Assert.Contains(rows, row => row.CorrelationId == acmeCorrelationId);
    Assert.DoesNotContain(rows, row => row.CorrelationId == taiCorrelationId);
    Assert.All(rows, row => Assert.Equal(AcmeTenantId.Value, row.TenantId));
  }

  [Fact]
  public async Task Recent_IgnoresBrowserSuppliedTenantBypassHeaders() {
    var taiCorrelationId = $"tai-{Guid.NewGuid()}";
    var acmeCorrelationId = $"acme-{Guid.NewGuid()}";
    var factory = CreateFactoryWithMockAuth(AdminUserId, new[] { "Admin" });
    await SeedAuditLogs(factory, taiCorrelationId, acmeCorrelationId);

    var client = CreateAdminClient(factory, "http://localhost/");
    client.DefaultRequestHeaders.Add("X-Bypass-Tenant", "true");
    client.DefaultRequestHeaders.Add("X-Tenant-Id", AcmeTenantId.Value.ToString());

    var response = await client.GetAsync("/api/AuditLogs/recent?limit=50");

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    var rows = await response.Content.ReadFromJsonAsync<List<RecentAuditLogResponse>>();
    Assert.NotNull(rows);
    Assert.Contains(rows, row => row.CorrelationId == taiCorrelationId);
    Assert.DoesNotContain(rows, row => row.CorrelationId == acmeCorrelationId);
    Assert.All(rows, row => Assert.Equal(TaiTenantId.Value, row.TenantId));
  }

  [Fact]
  public async Task Recent_Returns401WhenUnauthenticated() {
    var factory = CreateFactoryWithMockAuth("", Array.Empty<string>());
    var client = CreateAdminClient(factory, "http://localhost/");

    var response = await client.GetAsync("/api/AuditLogs/recent?limit=50");

    Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
  }

  [Fact]
  public async Task Recent_Returns403ForNonAdminRole() {
    var factory = CreateFactoryWithMockAuth("00000000-0000-0000-0000-000000000021", Array.Empty<string>());
    var client = CreateAdminClient(factory, "http://localhost/");

    var response = await client.GetAsync("/api/AuditLogs/recent?limit=50");

    Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
  }

  [Fact]
  public async Task Recent_Returns403WithWrongGatewaySecret() {
    var factory = CreateFactoryWithMockAuth(AdminUserId, new[] { "Admin" });
    var client = factory.CreateClient(new WebApplicationFactoryClientOptions {
      BaseAddress = new Uri("http://localhost/")
    });
    client.DefaultRequestHeaders.Add("X-Gateway-Secret", "wrong-secret");

    var response = await client.GetAsync("/api/AuditLogs/recent?limit=50");

    Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
  }

  private WebApplicationFactory<Program> CreateFactoryWithMockAuth(string userId, string[] roles) {
    return _factory.WithWebHostBuilder(builder => {
      builder.ConfigureTestServices(services => {
        services.AddAuthentication(options => {
          options.DefaultAuthenticateScheme = "IntegrationTestAuth";
          options.DefaultChallengeScheme = "IntegrationTestAuth";
        })
        .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>("IntegrationTestAuth", options => { });

        services.AddAuthorization(options => {
          options.DefaultPolicy = new AuthorizationPolicyBuilder()
              .AddAuthenticationSchemes("IntegrationTestAuth")
              .RequireAuthenticatedUser()
              .Build();
        });

        services.AddSingleton(new TestUserContext { UserId = userId, Roles = roles });
      });
    });
  }

  private HttpClient CreateAdminClient(WebApplicationFactory<Program> factory, string baseAddress) {
    var client = factory.CreateClient(new WebApplicationFactoryClientOptions {
      BaseAddress = new Uri(baseAddress)
    });
    client.DefaultRequestHeaders.Add("X-Gateway-Secret", _gatewaySecret);
    return client;
  }

  private async Task SeedAuditLogs(WebApplicationFactory<Program> factory, string taiCorrelationId, string acmeCorrelationId) {
    using var scope = factory.Services.CreateScope();
    var tenantService = scope.ServiceProvider.GetRequiredService<ITenantService>();
    var db = scope.ServiceProvider.GetRequiredService<PortalDbContext>();
    tenantService.SetTenant(new TenantId(Guid.Empty), isGlobalAccess: true);
    db.AuditLogs.Add(new AuditEntry(TaiTenantId, "tai-user", "PrivilegeModified", "tai-resource", taiCorrelationId, "127.0.0.1", "tai row"));
    db.AuditLogs.Add(new AuditEntry(AcmeTenantId, "acme-user", "PrivilegeModified", "acme-resource", acmeCorrelationId, "127.0.0.1", "acme row"));
    await db.SaveChangesAsync();
  }

  private sealed class RecentAuditLogResponse {
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string? CorrelationId { get; set; }
  }
}
```

- [ ] **Step 2: Run test to verify failure or pass**

Run:

```bash
dotnet test apps/portal-api.integration-tests/portal-api.integration-tests.csproj --filter AuditLogsRecentAuthorizationTests
```

Expected: PASS. This task must use the existing `WebApplicationFactory<Program>` + `TestAuthHandler` + `TestUserContext` pattern; do not introduce a custom API factory class or test-only request auth headers.

- [ ] **Step 3: Commit**

```bash
git add apps/portal-api.integration-tests/AuditLogsRecentAuthorizationTests.cs
git commit -m "test: cover recent audit log tenant isolation"
```

---

### Task 5: Panel State, Banner, Loading, and Stories

**Files:**
- Modify: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.types.ts`
- Modify: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.ts`
- Modify: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.html`
- Modify: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.scss`
- Modify: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.spec.ts`
- Modify: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.stories.ts`

- [ ] **Step 1: Add panel state tests**

Add tests to `notification-panel.component.spec.ts`:

```typescript
it('shows reconnect syncing instead of skeleton after initial hydrate', () => {
  fixture.componentRef.setInput('isLoading', true);
  fixture.componentRef.setInput('hasHydrated', true);
  fixture.componentRef.setInput('connectionState', 'reconnecting');
  fixture.detectChanges();

  expect(fixture.nativeElement.textContent).toContain('Syncing notifications...');
  expect(fixture.nativeElement.querySelectorAll('.skeleton-item')).toHaveLength(0);
});

it('suppresses connected banner for healthy empty state', () => {
  fixture.componentRef.setInput('notifications', []);
  fixture.componentRef.setInput('connectionState', 'connected');
  fixture.detectChanges();

  expect(fixture.nativeElement.textContent).not.toContain('Notifications are live.');
  expect(fixture.nativeElement.textContent).toContain('All caught up! No recent notifications');
});

it('shows error before reconnecting banner', () => {
  fixture.componentRef.setInput('connectionState', 'reconnecting');
  fixture.componentRef.setInput('error', 'Could not load notifications. Check your connection and try again.');
  fixture.detectChanges();

  expect(fixture.nativeElement.textContent).toContain('Could not load notifications. Check your connection and try again.');
  expect(fixture.nativeElement.textContent).not.toContain('Reconnecting to notification updates.');
});

it('renders one retry button when recovery notice and retry throttle are both active', () => {
  fixture.componentRef.setInput('recoveryNotice', 'Updates paused briefly. Cached notifications are still available.');
  fixture.componentRef.setInput('isRetryThrottled', true);
  fixture.detectChanges();

  const retryButtons = fixture.nativeElement.querySelectorAll('.retry-btn');
  expect(retryButtons).toHaveLength(1);
  expect(retryButtons[0].getAttribute('aria-disabled')).toBe('true');
  expect(fixture.nativeElement.textContent).toContain('Updates paused briefly. Cached notifications are still available.');
  expect(fixture.nativeElement.textContent).toContain('Try again shortly.');
});

it('delays initial skeleton for 300ms and keeps it visible for at least 300ms', fakeAsync(() => {
  fixture.componentRef.setInput('isLoading', true);
  fixture.componentRef.setInput('hasHydrated', false);
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelectorAll('.skeleton-item')).toHaveLength(0);

  tick(300);
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelectorAll('.skeleton-item')).toHaveLength(3);

  fixture.componentRef.setInput('isLoading', false);
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelectorAll('.skeleton-item')).toHaveLength(3);

  tick(300);
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelectorAll('.skeleton-item')).toHaveLength(0);
}));

it('shows search-specific empty copy when reconnect hydrate removes prior search matches', () => {
  panelService.setSearchText('privilege');
  fixture.componentRef.setInput('notifications', [criticalNotification]);
  fixture.componentRef.setInput('hasHydrated', true);
  fixture.componentRef.setInput('isLoading', true);
  fixture.componentRef.setInput('connectionState', 'reconnecting');
  fixture.detectChanges();

  fixture.componentRef.setInput('notifications', [warningNotification]);
  fixture.componentRef.setInput('isLoading', false);
  fixture.detectChanges();

  expect(fixture.nativeElement.textContent).toContain('No results for "privilege" among recent notifications.');
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
CI=true npx nx test design-system --testFile=notification-panel.component.spec.ts --skip-nx-cache
```

Expected: FAIL because the panel lacks these inputs and states.

- [ ] **Step 3: Add panel types and inputs**

Modify `notification-panel.types.ts`:

```typescript
export type NotificationPanelConnectionState = 'connected' | 'reconnecting' | 'disconnected';
```

Modify `notification-panel.component.ts`:

Update the existing class declaration to `export class NotificationPanelComponent implements OnChanges, OnDestroy`.

```typescript
import { OnChanges, OnDestroy, SimpleChanges } from '@angular/core';

@Input() hasHydrated = false;
@Input() connectionState: NotificationPanelConnectionState = 'connected';
@Input() recoveryNotice: string | null = null;

private skeletonDelayTimer: ReturnType<typeof setTimeout> | null = null;
private skeletonMinDisplayTimer: ReturnType<typeof setTimeout> | null = null;
private skeletonShownAt = 0;
protected showInitialSkeletonState = false;
private wasSearchMatchBeforeHydrate = false;
private hydrateSearchText: string | null = null;

readonly showInitialSkeleton = (): boolean => this.showInitialSkeletonState;
readonly isReconnectSyncing = (): boolean =>
  this.isLoading && this.hasHydrated && this.connectionState === 'reconnecting';
readonly hasVisibleNotifications = (): boolean => this.filteredNotifications().length > 0;
readonly showConnectionBanner = (): boolean =>
  !this.error &&
  !this.recoveryNotice &&
  (this.connectionState !== 'connected' || this.hasVisibleNotifications());
readonly showSearchToEmpty = (): boolean =>
  !this.isLoading &&
  !!this.searchText()() &&
  this.wasSearchMatchBeforeHydrate &&
  this.hydrateSearchText === this.searchText()() &&
  this.filteredNotifications().length === 0;
```

Add `OnChanges` and `OnDestroy` handling in `NotificationPanelComponent`:

```typescript
ngOnChanges(changes: SimpleChanges): void {
  if (changes['isLoading']) {
    if (this.isLoading) {
      this.captureSearchStateBeforeHydrate();
      this.startSkeletonDelay();
    } else {
      this.finishSkeleton();
    }
  }
}

ngOnDestroy(): void {
  this.clearSkeletonTimers();
}

private captureSearchStateBeforeHydrate(): void {
  const search = this.searchText()();
  this.hydrateSearchText = search || null;
  this.wasSearchMatchBeforeHydrate = !!search && this.filteredNotifications().length > 0;
}

private startSkeletonDelay(): void {
  this.clearSkeletonTimers();
  if (this.hasHydrated) {
    this.showInitialSkeletonState = false;
    return;
  }

  this.skeletonDelayTimer = setTimeout(() => {
    this.showInitialSkeletonState = true;
    this.skeletonShownAt = Date.now();
  }, 300);
}

private finishSkeleton(): void {
  if (!this.showInitialSkeletonState) {
    this.clearSkeletonTimers();
    return;
  }

  const remaining = Math.max(300 - (Date.now() - this.skeletonShownAt), 0);
  this.skeletonMinDisplayTimer = setTimeout(() => {
    this.showInitialSkeletonState = false;
    this.clearSkeletonTimers();
  }, remaining);
}

private clearSkeletonTimers(): void {
  if (this.skeletonDelayTimer) {
    clearTimeout(this.skeletonDelayTimer);
    this.skeletonDelayTimer = null;
  }
  if (this.skeletonMinDisplayTimer) {
    clearTimeout(this.skeletonMinDisplayTimer);
    this.skeletonMinDisplayTimer = null;
  }
}
```

- [ ] **Step 4: Add banner and sticky status markup**

Modify `notification-panel.component.html` so the status layout has one scroll region:

```html
@if (showConnectionBanner()) {
  <div class="connection-banner" [class]="'connection-' + connectionState" role="status" aria-live="polite" aria-label="Connection status">
    @if (connectionState === 'connected') {
      <span>Notifications are live.</span>
    }
    @if (connectionState === 'reconnecting') {
      <span>Reconnecting to notification updates.</span>
    }
    @if (connectionState === 'disconnected') {
      <span>Notification updates are offline. Recent items may be stale.</span>
      <button type="button" class="retry-btn" [disabled]="isLoading" [attr.aria-disabled]="isRetryThrottled" (click)="onRetry()">Retry</button>
    }
  </div>
}

<div class="notification-scroll-region">
  <div class="sticky-status-area">
    @if (error) {
      <div class="panel-status panel-status-error" role="alert" aria-live="assertive">
        <span>{{ error }}</span>
        <button type="button" class="retry-btn" [disabled]="isLoading" [attr.aria-disabled]="isRetryThrottled" (click)="onRetry()">Retry</button>
        @if (isRetryThrottled) {
          <span class="retry-helper">Try again shortly.</span>
        }
      </div>
    } @else if (recoveryNotice) {
      <div class="panel-status panel-status-recovery" role="status" aria-live="polite">
        <span>{{ recoveryNotice }}</span>
        <button type="button" class="retry-btn" [disabled]="isLoading" [attr.aria-disabled]="isRetryThrottled" (click)="onRetry()">Retry</button>
        @if (isRetryThrottled) {
          <span class="retry-helper">Try again shortly.</span>
        }
      </div>
    } @else if (isReconnectSyncing()) {
      <div class="panel-status panel-status-loading" role="status" aria-live="polite">Syncing notifications...</div>
    }
  </div>

  @if (showInitialSkeleton()) {
    <div class="skeleton-list" role="status" aria-live="polite">
      <div class="skeleton-item" aria-busy="true"></div>
      <div class="skeleton-item" aria-busy="true"></div>
      <div class="skeleton-item" aria-busy="true"></div>
    </div>
  }

  <div class="event-list" data-testid="notification-list" role="list" aria-live="polite">
    @for (notification of filteredNotifications(); track notification.id) {
      <div
        class="event-item"
        data-testid="notification-item"
        role="listitem"
        [class]="getSeverityClass(notification.severity)"
        [attr.data-notification-id]="notification.id"
        [attr.tabindex]="rovingNotificationId() === notification.id ? 0 : -1"
        [attr.aria-label]="notification.readAt ? 'Read notification' : 'Unread notification'">
        @if (!notification.readAt) {
          <span class="unread-marker"></span>
        } @else {
          <span class="read-marker"></span>
        }
        <div class="event-severity-bar"></div>
        <div class="event-content">
          <div class="event-action">{{ notification.title }}</div>
          <div class="event-summary">{{ notification.summary }}</div>
          <div class="event-meta">
            <span class="event-time">{{ formatTime(notification.timestamp) }}</span>
            @if (notification.actor) {
              <span class="event-user">{{ notification.actor }}</span>
            }
          </div>
        </div>
      </div>
    } @empty {
      @if (!showInitialSkeleton() && !error) {
        @if (showSearchToEmpty()) {
          <div class="empty-state" role="status" aria-live="polite">No results for "{{ searchText()() }}" among recent notifications.</div>
        } @else {
          <div class="empty-state" role="status" aria-live="polite">
            <div>All caught up! No recent notifications</div>
            <div class="empty-caption">Privilege, approval, and security events will appear here.</div>
          </div>
        }
      }
    }
  </div>
</div>
```

- [ ] **Step 5: Add CSS for banners and scroll region**

Modify `notification-panel.component.scss`:

```scss
.notification-panel {
  display: flex;
  flex-direction: column;
  max-height: 100vh;
}

.connection-banner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  margin: 8px 0 0;
  padding: 8px 10px;
  border-radius: 6px;
  color: #fff;
  font-size: 14px;
  line-height: 20px;
}

.connection-connected { background: #047857; }
.connection-reconnecting { background: #B45309; }
.connection-disconnected { background: #B91C1C; }

.notification-scroll-region {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.sticky-status-area {
  position: sticky;
  top: 0;
  z-index: 2;
}

@media (prefers-reduced-motion: no-preference) {
  .connection-banner,
  .skeleton-item {
    transition: opacity 160ms ease;
  }
}
```

- [ ] **Step 6: Update stories**

Modify `notification-panel.stories.ts` to add `connectionState`, `hasHydrated`, and `recoveryNotice` args and three variants:

```typescript
export const Connected = {
  args: {
    connectionState: 'connected',
    hasHydrated: true,
  },
};

export const Reconnecting = {
  args: {
    connectionState: 'reconnecting',
    hasHydrated: true,
    isLoading: true,
  },
};

export const Disconnected = {
  args: {
    connectionState: 'disconnected',
    hasHydrated: true,
  },
};
```

- [ ] **Step 7: Run design-system tests**

Run:

```bash
CI=true npx nx test design-system --testFile=notification-panel.component.spec.ts --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add libs/ui/design-system/src/lib/organisms/notification-panel
git commit -m "feat: add notification panel connection states"
```

---

### Task 6: Panel Focus Trap and Keyboard Model

**Files:**
- Modify: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.ts`
- Modify: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.html`
- Modify: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.scss`
- Modify: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.spec.ts`

- [ ] **Step 1: Write failing focus tests**

Add tests:

```typescript
it('uses search as initial focus target when notifications exist', () => {
  fixture.componentRef.setInput('notifications', [criticalNotification]);
  fixture.detectChanges();
  const search = fixture.nativeElement.querySelector('#notification-search');
  expect(search.hasAttribute('cdkFocusInitial')).toBe(true);
});

it('makes the first visible notification tabbable by default', () => {
  fixture.componentRef.setInput('notifications', [criticalNotification, warningNotification]);
  fixture.detectChanges();

  const items = fixture.nativeElement.querySelectorAll('[data-testid="notification-item"]');
  expect(items[0].getAttribute('tabindex')).toBe('0');
  expect(items[1].getAttribute('tabindex')).toBe('-1');
});

it('keeps filter focus after filter removes previously focused item', () => {
  fixture.componentRef.setInput('notifications', [criticalNotification, warningNotification]);
  fixture.detectChanges();
  component.focusNotificationForTest(criticalNotification.id);

  const warningButton = fixture.nativeElement.querySelector('[data-testid="filter-warning"]') as HTMLButtonElement;
  warningButton.focus();
  warningButton.click();
  fixture.detectChanges();

  expect(document.activeElement).toBe(warningButton);
  expect(component.focusedNotificationIdForTest()).toBe(warningNotification.id);
});

it('clears non-empty search on Escape before closing panel', () => {
  const closeSpy = vi.spyOn(component, 'close');
  panelService.setSearchText('privilege');
  fixture.detectChanges();

  const search = fixture.nativeElement.querySelector('#notification-search') as HTMLInputElement;
  search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

  expect(panelService.searchText()()).toBe('');
  expect(closeSpy).not.toHaveBeenCalled();
});

it('moves focus after Mark All Read disables the native button', fakeAsync(() => {
  fixture.componentRef.setInput('notifications', [criticalNotification]);
  fixture.detectChanges();

  const markAllButton = fixture.nativeElement.querySelector('.mark-all-btn') as HTMLButtonElement;
  markAllButton.focus();
  markAllButton.click();

  fixture.componentRef.setInput('notifications', [{ ...criticalNotification, readAt: '2026-05-15T12:00:00.000Z' }]);
  fixture.detectChanges();
  tick();

  expect(document.activeElement).toBe(fixture.nativeElement.querySelector('[data-testid="notification-item"]'));
}));

it('moves focus to close button when mutation leaves no visible notifications', fakeAsync(() => {
  fixture.componentRef.setInput('notifications', [criticalNotification]);
  fixture.detectChanges();
  component.focusNotificationForTest(criticalNotification.id);

  fixture.componentRef.setInput('notifications', []);
  fixture.detectChanges();
  component.applyFocusAfterMutationForTest(criticalNotification.id, 0);
  tick();

  expect(document.activeElement).toBe(fixture.nativeElement.querySelector('.close-btn'));
}));

it('preserves scroll position relative to focused notification when hydrated items prepend', fakeAsync(() => {
  const list = fixture.nativeElement.querySelector('.notification-scroll-region') as HTMLElement;
  const focusedId = 'event-050';
  list.scrollTop = 400;

  component.preserveScrollDuringPrependForTest(list, focusedId, () => {
    fixture.componentRef.setInput('notifications', [newerNotification, criticalNotification, warningNotification]);
    fixture.detectChanges();
  });
  tick();

  expect(list.scrollTop).toBeGreaterThanOrEqual(400);
}));
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
CI=true npx nx test design-system --testFile=notification-panel.component.spec.ts --skip-nx-cache
```

Expected: FAIL because focus trap, roving focus, and Escape handling are not implemented.

- [ ] **Step 3: Import CDK a11y directives**

Modify `notification-panel.component.ts`:

```typescript
import { A11yModule } from '@angular/cdk/a11y';
import { afterNextRender } from '@angular/core';

@Component({
  imports: [CommonModule, FormsModule, A11yModule],
})
```

If Task 5 already added an `@angular/core` import for `OnChanges`, `OnDestroy`, and `SimpleChanges`, merge `afterNextRender` into that import instead of adding a duplicate import statement.

- [ ] **Step 4: Add focus state and handlers**

Add this top-level type above `NotificationPanelComponent`:

```typescript
type FocusTarget =
  | { kind: 'item'; id: string; index: number }
  | { kind: 'close-button'; id: null; index: -1 };
```

Add these members to `NotificationPanelComponent`:

```typescript
private focusedNotificationId: string | null = null;

focusedNotificationIdForTest(): string | null {
  return this.focusedNotificationId;
}

focusNotificationForTest(id: string): void {
  this.focusedNotificationId = id;
}

readonly firstVisibleNotificationId = (): string | null => this.filteredNotifications()[0]?.id ?? null;
readonly rovingNotificationId = (): string | null =>
  this.focusedNotificationId ?? this.firstVisibleNotificationId();

onSearchKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') {
    return;
  }

  if (this.searchText()()) {
    event.stopPropagation();
    this.panelService.setSearchText('');
    return;
  }

  this.close();
}

onFilterClick(filter: SeverityFilter): void {
  const previousId = this.focusedNotificationId;
  const previousIndex = this.filteredNotifications().findIndex(item => item.id === previousId);
  this.panelService.setSeverityFilter(filter);
  this.focusedNotificationId = this.resolveFocusAfterMutation(previousId, previousIndex).id;
}

onMarkAllRead(): void {
  if (!this.hasUnread()) {
    return;
  }

  const previousId = this.focusedNotificationId;
  const previousIndex = this.filteredNotifications().findIndex(item => item.id === previousId);
  this.markAllRead.emit();

  afterNextRender(() => {
    const target = this.resolveFocusAfterMutation(previousId, previousIndex);
    this.focusedNotificationId = target.id;
    this.focusTarget(target);
  });
}

onListKeydown(event: KeyboardEvent): void {
  const items = this.filteredNotifications();
  if (items.length === 0) {
    return;
  }

  const currentIndex = Math.max(0, items.findIndex(item => item.id === this.focusedNotificationId));
  const nextIndex =
    event.key === 'ArrowDown' ? (currentIndex + 1) % items.length :
    event.key === 'ArrowUp' ? (currentIndex - 1 + items.length) % items.length :
    event.key === 'Home' ? 0 :
    event.key === 'End' ? items.length - 1 :
    -1;

  if (nextIndex >= 0) {
    event.preventDefault();
    this.focusedNotificationId = items[nextIndex].id;
    afterNextRender(() => {
      document.querySelector<HTMLElement>(`[data-notification-id="${items[nextIndex].id}"]`)?.focus();
    });
  }
}

private resolveFocusAfterMutation(previousId: string | null, previousIndex: number): FocusTarget {
  const visibleItems = this.filteredNotifications();
  if (visibleItems.length === 0) {
    return { kind: 'close-button', id: null, index: -1 };
  }

  if (previousId) {
    const sameItemIndex = visibleItems.findIndex(item => item.id === previousId);
    if (sameItemIndex >= 0) {
      return { kind: 'item', id: previousId, index: sameItemIndex };
    }
  }

  const clampedIndex = Math.min(Math.max(previousIndex, 0), visibleItems.length - 1);
  return { kind: 'item', id: visibleItems[clampedIndex].id, index: clampedIndex };
}

private focusTarget(target: FocusTarget): void {
  if (target.kind === 'close-button') {
    document.querySelector<HTMLElement>('.notification-panel .close-btn')?.focus();
    return;
  }

  document.querySelector<HTMLElement>(`[data-notification-id="${target.id}"]`)?.focus();
}

applyFocusAfterMutationForTest(previousId: string | null, previousIndex: number): void {
  const target = this.resolveFocusAfterMutation(previousId, previousIndex);
  this.focusedNotificationId = target.id;
  afterNextRender(() => this.focusTarget(target));
}

preserveScrollDuringPrependForTest(list: HTMLElement, focusedNotificationId: string | null, mutate: () => void): void {
  this.preserveScrollDuringPrepend(list, focusedNotificationId, mutate);
}

private preserveScrollDuringPrepend(list: HTMLElement, focusedNotificationId: string | null, mutate: () => void): void {
  const beforeScrollTop = list.scrollTop;
  const beforeScrollHeight = list.scrollHeight;
  const focusedBefore = focusedNotificationId
    ? list.querySelector<HTMLElement>(`[data-notification-id="${focusedNotificationId}"]`)
    : null;
  const focusedViewportTop = focusedBefore ? focusedBefore.offsetTop - list.scrollTop : null;

  mutate();

  afterNextRender(() => {
    if (focusedNotificationId && focusedViewportTop !== null) {
      const focusedAfter = list.querySelector<HTMLElement>(`[data-notification-id="${focusedNotificationId}"]`);
      if (focusedAfter) {
        list.scrollTop = focusedAfter.offsetTop - focusedViewportTop;
        return;
      }
    }

    const prependedHeight = Math.max(list.scrollHeight - beforeScrollHeight, 0);
    list.scrollTop = beforeScrollTop + prependedHeight;
  });
}
```

- [ ] **Step 5: Refactor template focus order**

Modify `notification-panel.component.html` so focusable DOM order is search, filters, Mark All Read, items, close when notifications exist. The close button may be visually positioned with CSS.

```html
@if (isOpen()()) {
  <div class="notification-panel-container" cdkTrapFocus cdkTrapFocusAutoCapture (keydown.escape)="close()">
    <div class="panel-overlay" (click)="close()" role="presentation" aria-hidden="true"></div>
    <div id="notification-panel" class="notification-panel" role="dialog" aria-modal="true" aria-labelledby="notifications-heading">
      <div class="panel-header">
        <h3 id="notifications-heading">Notifications</h3>
      </div>

      <div class="search-box">
        <label for="notification-search" class="visually-hidden">Search notifications</label>
        <input
          id="notification-search"
          type="text"
          placeholder="Search notifications..."
          aria-label="Search notifications"
          [attr.cdkFocusInitial]="filteredNotifications().length > 0 ? '' : null"
          [value]="searchText()()"
          (input)="onSearchChange($event)"
          (keydown)="onSearchKeydown($event)" />
      </div>

      <div class="filter-buttons" role="group" aria-label="Filter notifications">
        <button data-testid="filter-all" type="button" [attr.aria-pressed]="severityFilter()() === 'all'" (click)="onFilterClick('all')">All</button>
        <button data-testid="filter-critical" type="button" [attr.aria-pressed]="severityFilter()() === 'critical'" (click)="onFilterClick('critical')">Critical</button>
        <button data-testid="filter-warning" type="button" [attr.aria-pressed]="severityFilter()() === 'warning'" (click)="onFilterClick('warning')">Warning</button>
        <button data-testid="filter-info" type="button" [attr.aria-pressed]="severityFilter()() === 'info'" (click)="onFilterClick('info')">Info</button>
      </div>

      <button type="button" class="mark-all-btn" [disabled]="!hasUnread()" (click)="onMarkAllRead()">Mark all read</button>

      <div class="notification-scroll-region" (keydown)="onListKeydown($event)">
        <div class="sticky-status-area">
          @if (error) {
            <div class="panel-status panel-status-error" role="alert" aria-live="assertive">
              <span>{{ error }}</span>
              <button type="button" class="retry-btn" [disabled]="isLoading" [attr.aria-disabled]="isRetryThrottled" (click)="onRetry()">Retry</button>
            </div>
          }
        </div>

        <div class="event-list" data-testid="notification-list" role="list" aria-live="polite">
          @for (notification of filteredNotifications(); track notification.id) {
            <div
              class="event-item"
              data-testid="notification-item"
              role="listitem"
              [class]="getSeverityClass(notification.severity)"
              [attr.data-notification-id]="notification.id"
              [attr.tabindex]="rovingNotificationId() === notification.id ? 0 : -1"
              [attr.aria-label]="notification.readAt ? 'Read notification' : 'Unread notification'">
              <div class="event-content">
                <div class="event-action">{{ notification.title }}</div>
                <div class="event-summary">{{ notification.summary }}</div>
              </div>
            </div>
          } @empty {
            @if (!showInitialSkeleton() && !error) {
              <div class="empty-state" role="status" aria-live="polite">All caught up! No recent notifications</div>
            }
          }
        </div>
      </div>

      <button class="close-btn" type="button" (click)="close()" aria-label="Close notifications panel">Close</button>
    </div>
  </div>
}
```

- [ ] **Step 6: Add focus-visible styles**

Modify SCSS:

```scss
.event-item:focus-visible,
.close-btn:focus-visible,
.mark-all-btn:focus-visible,
.filter-buttons button:focus-visible,
.retry-btn:focus-visible {
  outline: 2px solid #3B82F6;
  outline-offset: 2px;
}
```

- [ ] **Step 7: Run focus tests**

Run:

```bash
CI=true npx nx test design-system --testFile=notification-panel.component.spec.ts --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add libs/ui/design-system/src/lib/organisms/notification-panel
git commit -m "feat: add accessible notification panel keyboard model"
```

---

### Task 7: Toggle Indicator and App Wiring

**Files:**
- Modify: `libs/ui/design-system/src/lib/molecules/notification-toggle/notification-toggle.component.ts`
- Modify: `libs/ui/design-system/src/lib/molecules/notification-toggle/notification-toggle.component.html`
- Modify: `libs/ui/design-system/src/lib/molecules/notification-toggle/notification-toggle.component.scss`
- Modify: `libs/ui/design-system/src/lib/molecules/notification-toggle/notification-toggle.spec.ts`
- Modify: `apps/portal-web/src/app/app.html`

- [ ] **Step 1: Write failing toggle tests**

Add tests:

```typescript
it('sets aria-expanded and aria-controls', () => {
  fixture.componentRef.setInput('isOpen', true);
  fixture.detectChanges();
  const button = fixture.nativeElement.querySelector('button');
  expect(button.getAttribute('aria-expanded')).toBe('true');
  expect(button.getAttribute('aria-controls')).toBe('notification-panel');
});

it('shows reconnecting status in accessible label', () => {
  fixture.componentRef.setInput('connectionState', 'reconnecting');
  fixture.detectChanges();
  const button = fixture.nativeElement.querySelector('button');
  expect(button.getAttribute('aria-label')).toBe('Toggle notifications, updates reconnecting');
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
CI=true npx nx test design-system --testFile=notification-toggle.component.spec.ts --skip-nx-cache
```

Expected: FAIL because inputs and indicator do not exist.

- [ ] **Step 3: Add toggle inputs and label**

Modify `notification-toggle.component.ts`:

```typescript
import { NotificationPanelConnectionState } from '../../organisms/notification-panel/notification-panel.types';

isOpen = input(false);
connectionState = input<NotificationPanelConnectionState>('connected');

readonly accessibleLabel = computed(() => {
  switch (this.connectionState()) {
    case 'reconnecting':
      return 'Toggle notifications, updates reconnecting';
    case 'disconnected':
      return 'Toggle notifications, updates offline';
    default:
      return 'Toggle notifications';
  }
});

readonly showConnectionIndicator = computed(() => this.connectionState() !== 'connected');
```

- [ ] **Step 4: Add toggle markup and styles**

Modify `notification-toggle.component.html`:

```html
<button
  class="toggle-button"
  type="button"
  (click)="toggle()"
  [attr.aria-label]="accessibleLabel()"
  [attr.aria-expanded]="isOpen()"
  aria-controls="notification-panel">
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
  </svg>
  @if (showBadge()) {
    <span class="unread-badge">{{ displayCount() }}</span>
  }
  @if (showConnectionIndicator()) {
    <span class="connection-indicator" [class]="connectionState()" aria-hidden="true"></span>
  }
</button>
```

Modify `notification-toggle.component.scss`:

```scss
.connection-indicator {
  position: absolute;
  right: 6px;
  bottom: 6px;
  width: 10px;
  height: 10px;
  border: 2px solid #fff;
  border-radius: 999px;
}

.connection-indicator.reconnecting {
  background: #B45309;
}

.connection-indicator.disconnected {
  background: #B91C1C;
}
```

- [ ] **Step 5: Wire App template without replacing panel bindings**

Preserve the `tai-notification-panel` block added in Task 3. Modify only the existing `tai-notification-toggle` element and keep the merged notification section of `apps/portal-web/src/app/app.html` in this form:

```html
<tai-notification-toggle
  [unreadCount]="notificationStore.unreadCount()"
  [isOpen]="notificationPanelService.isOpen()()"
  [connectionState]="notificationPanelConnectionState()"
  (toggled)="notificationPanelService.toggle()">
</tai-notification-toggle>
<tai-notification-panel
  [notifications]="notificationPanelItems()"
  [isLoading]="notificationStore.isHydrating()"
  [hasHydrated]="notificationStore.hasHydrated()"
  [error]="notificationStore.hydrationError()"
  [connectionState]="notificationPanelConnectionState()"
  [isRetryThrottled]="notificationHistoryService.isRetryThrottled()"
  [recoveryNotice]="notificationHistoryService.forceRetryNotice()"
  (retry)="notificationHistoryService.retry()"
  (markRead)="markNotificationRead($event)"
  (markAllRead)="markAllNotificationsRead()"
  (acknowledge)="acknowledgeNotification($event)">
</tai-notification-panel>
```

- [ ] **Step 6: Run toggle tests**

Run:

```bash
CI=true npx nx test design-system --testFile=notification-toggle.component.spec.ts --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add libs/ui/design-system/src/lib/molecules/notification-toggle apps/portal-web/src/app/app.html
git commit -m "feat: expose notification toggle connection state"
```

---

### Task 8: E2E Notification Resilience and Accessibility

**Files:**
- Create: `apps/portal-web-e2e/src/notifications-resilience.spec.ts`
- Create: `apps/portal-web-e2e/src/notifications-edge-states.spec.ts`
- Create: `apps/portal-web-e2e/src/notifications-accessibility.spec.ts`
- Modify: `apps/portal-web-e2e/playwright.config.ts`

- [ ] **Step 1: Document test-build server requirement**

Modify `apps/portal-web-e2e/playwright.config.ts` near `baseURL`:

```typescript
// Notification Sprint 4 specs require portal-web to be served with:
// npx nx run portal-web:serve --configuration=test --port=4200 --host=0.0.0.0
// The test configuration enables window.__testConnectionStateOverride__.
```

Do not enable the commented `webServer` block in this task; CI starts all services from `.github/workflows/main.yml`.

- [ ] **Step 2: Add resilience E2E test**

Create `notifications-resilience.spec.ts`:

```typescript
import { expect, test } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import { injectAuthSession } from './test-utils';

test('reconnect rehydration recovers missed privilege events', async ({ page }) => {
  await injectAuthSession(page, 'acme-session.json');
  await page.goto('http://acme.localhost:4200/admin/privileges');
  await page.getByRole('button', { name: /toggle notifications/i }).click();

  await page.evaluate(() => {
    window.__testConnectionStateOverride__('Disconnected');
  });

  await expect(page.getByText('Notification updates are offline. Recent items may be stale.')).toBeVisible();

  const correlationId = uuidv4();
  await page.getByRole('button', { name: /close notifications panel/i }).click();
  await page.route('**/api/privileges/**', async route => {
    await route.continue({
      headers: {
        ...route.request().headers(),
        'X-Correlation-ID': correlationId,
        'X-Step-Up-Verified': 'true',
      },
    });
  });

  await page.getByPlaceholder(/search privileges/i).fill('Portal.Users.Read');
  await page.getByRole('button', { name: /edit/i }).first().click();
  await page.getByLabel(/description/i).fill(`Reconnect recovery update ${correlationId}`);
  await page.getByRole('button', { name: /save changes/i }).click();

  await page.getByRole('button', { name: /toggle notifications/i }).click();
  await page.evaluate(() => {
    window.__testConnectionStateOverride__('Connected');
  });

  await expect(page.getByTestId('notification-item').filter({ hasText: correlationId })).toBeVisible({ timeout: 10000 });
});
```

- [ ] **Step 3: Add edge state E2E test**

Create `notifications-edge-states.spec.ts`:

```typescript
import { expect, test } from '@playwright/test';
import { injectAuthSession } from './test-utils';

test('initial loading and reconnect syncing use different visuals', async ({ page }) => {
  await injectAuthSession(page, 'acme-session.json');
  await page.route('**/api/AuditLogs/recent?limit=50', async route => {
    await new Promise(resolve => setTimeout(resolve, 350));
    await route.fulfill({ status: 200, json: [] });
  });

  await page.goto('http://acme.localhost:4200/admin/privileges');
  await page.getByRole('button', { name: /toggle notifications/i }).click();
  await expect(page.locator('.skeleton-item')).toHaveCount(3);
  await expect(page.getByText('All caught up! No recent notifications')).toBeVisible();

  await page.evaluate(() => window.__testConnectionStateOverride__('Reconnecting'));
  await expect(page.getByText('Syncing notifications...')).toBeVisible();
  await expect(page.locator('.skeleton-item')).toHaveCount(0);
});

test('connected banner is suppressed for healthy empty state', async ({ page }) => {
  await injectAuthSession(page, 'acme-session.json');
  await page.route('**/api/AuditLogs/recent?limit=50', route => route.fulfill({ status: 200, json: [] }));
  await page.goto('http://acme.localhost:4200/admin/privileges');
  await page.getByRole('button', { name: /toggle notifications/i }).click();
  await expect(page.getByText('All caught up! No recent notifications')).toBeVisible();
  await expect(page.getByText('Notifications are live.')).toBeHidden();
});
```

- [ ] **Step 4: Add accessibility E2E test**

Create `notifications-accessibility.spec.ts`:

```typescript
import { expect, test } from '@playwright/test';
import { injectAuthSession } from './test-utils';

test('keyboard user can open, filter, search, navigate, and close notifications', async ({ page }) => {
  await injectAuthSession(page, 'acme-session.json');
  await page.goto('http://acme.localhost:4200/admin/privileges');

  await page.getByRole('button', { name: /toggle notifications/i }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: /notifications/i })).toBeVisible();
  await expect(page.getByLabel('Search notifications')).toBeFocused();

  await page.keyboard.type('privilege');
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Search notifications')).toHaveValue('');
  await expect(page.getByRole('dialog', { name: /notifications/i })).toBeVisible();

  await page.getByRole('button', { name: 'Critical' }).click();
  await expect(page.getByRole('button', { name: 'Critical' })).toHaveAttribute('aria-pressed', 'true');

  const dialog = page.getByRole('dialog', { name: /notifications/i });
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press('Tab');
    const activeInsideDialog = await dialog.evaluate((node) => node.contains(document.activeElement));
    expect(activeInsideDialog).toBe(true);
  }

  await page.getByRole('button', { name: /close notifications panel/i }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: /toggle notifications/i })).toBeFocused();

  await page.getByRole('button', { name: /toggle notifications/i }).click();
  await expect(dialog).toBeVisible();
  await page.locator('.panel-overlay').click({ position: { x: 5, y: 5 } });
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: /toggle notifications/i })).toBeFocused();

  await page.getByRole('button', { name: /toggle notifications/i }).click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: /notifications/i })).toBeHidden();
  await expect(page.getByRole('button', { name: /toggle notifications/i })).toBeFocused();
});
```

- [ ] **Step 5: Run E2E tests**

Run:

```bash
CI=true npx nx e2e portal-web-e2e --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/portal-web-e2e/playwright.config.ts apps/portal-web-e2e/src/notifications-resilience.spec.ts apps/portal-web-e2e/src/notifications-edge-states.spec.ts apps/portal-web-e2e/src/notifications-accessibility.spec.ts
git commit -m "test: add notification sprint 4 e2e coverage"
```

---

### Task 9: CI Production Hook Verification

**Files:**
- Modify: `.github/workflows/main.yml`

- [ ] **Step 1: Add CI production grep check**

Modify the existing `ci` job in `.github/workflows/main.yml`. Add these steps immediately after `Build Affected` and before database migration/test steps. This check runs every time the `ci` job runs; it does not depend on Nx affected output.

```yaml
- name: Build portal-web production
  run: npx nx build portal-web --configuration=production --skip-nx-cache

- name: Verify notification E2E hook is absent from production bundle
  run: |
    if rg "__testConnectionStateOverride__" dist/apps/portal-web/browser; then
      echo "Test-only notification connection hook leaked into production bundle"
      exit 1
    fi
```

- [ ] **Step 2: Serve portal-web E2E with test configuration**

Modify the `e2e` job's `Start Background Services` step in `.github/workflows/main.yml`. Replace the portal-web serve command:

```yaml
npx nx run portal-web:serve --configuration=test --port=4200 --host=0.0.0.0 &
```

This keeps existing API, gateway, identity UI, and docviewer startup unchanged while enabling the notification connection test hook for E2E only.

- [ ] **Step 3: Run local production check**

Run:

```bash
CI=true npx nx build portal-web --configuration=production --skip-nx-cache
if rg "__testConnectionStateOverride__" dist/apps/portal-web/browser; then exit 1; fi
```

Expected: build exits 0 and grep check exits 0.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/main.yml
git commit -m "ci: verify notification test hook is production gated"
```

---

### Rollback Plan

Use this section if Sprint 4 introduces a production-blocking issue after merge.

- [ ] **Step 1: Revert the Sprint 4 commit series**

Run:

```bash
git log --oneline --grep="notification" -n 20
git revert <oldest-sprint-4-commit>^..<newest-sprint-4-commit>
```

Expected: the revert commit removes the environment file replacements, App connection hook, force retry API, panel/toggle UI changes, E2E specs, backend authorization tests, and CI grep additions together.

- [ ] **Step 2: If only build gating fails, remove the file replacements**

Modify `apps/portal-web/project.json` to remove only the `fileReplacements` entries from `production`, `development`, and `test`, and remove `serve.configurations.test`. Leave unrelated build options unchanged.

Run:

```bash
CI=true npx nx build portal-web --configuration=production --skip-nx-cache
if rg "__testConnectionStateOverride__" dist/apps/portal-web/browser; then exit 1; fi
```

Expected: production build exits 0 and the hook grep exits 0.

- [ ] **Step 3: If CI grep fails after merge**

Do not bypass the grep check. Revert the App hook/environment commit or remove all references to `window.__testConnectionStateOverride__` from production-reachable code, then rerun:

```bash
CI=true npx nx build portal-web --configuration=production --skip-nx-cache
if rg "__testConnectionStateOverride__" dist/apps/portal-web/browser; then exit 1; fi
```

Expected: production build exits 0 and the hook grep exits 0.

---

### Task 10: Full Verification

**Files:**
- Verify all files changed in Tasks 1-9.

- [ ] **Step 1: Run unit tests**

```bash
CI=true npx nx test portal-web --skip-nx-cache
CI=true npx nx test design-system --skip-nx-cache
```

Expected: both commands exit 0.

- [ ] **Step 2: Run backend integration tests**

```bash
dotnet test apps/portal-api.integration-tests/portal-api.integration-tests.csproj
```

Expected: exits 0.

- [ ] **Step 3: Run lint**

```bash
CI=true npx nx lint portal-web --skip-nx-cache
CI=true npx nx lint design-system --skip-nx-cache
```

Expected: both commands exit 0.

- [ ] **Step 4: Run build and hook checks**

```bash
CI=true npx nx build portal-web --configuration=production --skip-nx-cache
rg "enableE2eConnectionHook: false|enableE2eConnectionHook\\\":false" dist/apps/portal-web/browser || true
if rg "__testConnectionStateOverride__" dist/apps/portal-web/browser; then exit 1; fi
CI=true npx nx build portal-web --configuration=test --skip-nx-cache
rg "enableE2eConnectionHook: true|enableE2eConnectionHook\\\":true" dist/apps/portal-web/browser || true
rg "__testConnectionStateOverride__" dist/apps/portal-web/browser
```

Expected: production build exits 0, production hook grep check exits 0, test build exits 0, and test grep finds the hook. The environment-value grep commands are diagnostic because esbuild may inline or optimize the object away; if they find values, they must match the requested configuration.

- [ ] **Step 5: Run Storybook build**

```bash
CI=true npx nx build-storybook design-system --skip-nx-cache
```

Expected: exits 0.

- [ ] **Step 6: Run E2E**

```bash
CI=true npx nx e2e portal-web-e2e --skip-nx-cache
```

Expected: exits 0.

- [ ] **Step 7: Verify no notification content uses innerHTML**

```bash
rg -n "\[innerHTML\]|innerHTML" libs/ui/design-system/src/lib/organisms/notification-panel apps/portal-web/src/app
```

Expected: no matches for notification title, summary, actor, category, error, or recovery content.

- [ ] **Step 8: Commit verification fixes if needed**

If verification required fixes, commit them:

```bash
git add apps libs .github
git commit -m "fix: complete notification sprint 4 verification"
```

Expected: commit created only when verification changes were necessary.

---

## Self-Review

Spec coverage:

- Environment-gated test hook: Task 1, Task 3, Task 9, Task 10.
- Reconnect RxJS trigger with latest-state recheck: Task 3.
- Force retry, separate force map, cleanup, retry UI signals: Task 2.
- Backend tenant isolation for `/api/AuditLogs/recent`: Task 4.
- Panel connection state, banner priority, loading differentiation, search-to-empty state, sticky status area: Task 5.
- Focus trap, DOM order, `cdkFocusInitial`, roving focus, search Escape, filter focus: Task 6.
- Toggle ARIA and closed-panel indicator: Task 7.
- E2E resilience, edge state, and accessibility coverage: Task 8.
- CI production grep check and full verification: Task 9 and Task 10.

Placeholder scan:

- No placeholder markers or unspecified edge-case steps remain.
- Each code-changing task includes concrete file paths, code snippets, commands, and expected outcomes.

Type consistency:

- `NotificationPanelConnectionState` is defined once in `notification-panel.types.ts`.
- App mapping returns the UI-local type and imports it from the design system.
- Panel inputs use `connectionState`, `hasHydrated`, `isRetryThrottled`, and `recoveryNotice` consistently.
- History service exposes `forceRetryPausedUntil`, `forceRetryNotice`, and `isRetryThrottled` as signal-style readonly properties.
