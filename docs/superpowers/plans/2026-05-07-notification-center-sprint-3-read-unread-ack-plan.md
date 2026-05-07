# Notification Center Sprint 3 Read/Unread + Acknowledgement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user-scoped notification lifecycle state with read/unread, critical acknowledgement, localStorage persistence, and accessible panel controls.

**Architecture:** `NotificationSignalStore` remains the source of notification truth and owns lifecycle overlay/mutation. A small lifecycle storage helper isolates localStorage parsing, key encoding, retention, and error handling. Design-system components stay app-store agnostic: the panel emits lifecycle actions and the toggle receives unread count via input.

**Tech Stack:** Angular standalone components, Angular signals, RxJS, Vitest, Nx, localStorage, Playwright e2e.

---

## Implementation Notes

- Spec: `docs/superpowers/specs/2026-05-07-notification-center-sprint-3-read-unread-ack-test-spec.md`.
- Use `encodeURIComponent(String(value))` for tenant, OIDC subject, and event ID key segments.
- `AuthService.User.id` is the OIDC `sub`; use it for lifecycle scope. Do not use email in storage keys.
- Keep audit events as the durable source. Do not add backend notification tables or APIs.
- Do not make design-system components import portal-web stores.
- Keep existing Sprint 2 hydration tests passing.
- Idempotency key encoding is an in-memory cache format change, not persisted data migration. Existing page sessions naturally reload on deploy; tests must update the key helper contract atomically with the implementation. Do not add a dual raw-key lookup because that preserves the collision bug.
- `clearNotifications()` and `clearForAuthBoundaryChange()` remain the supported in-memory idempotency cache reset paths.
- Angular is `~21.1.0`; `fixture.componentRef.setInput()` is available for input tests.
- Prefer fake timers for lifecycle timestamp tests:

```typescript
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-07T18:00:00.000Z'));
});

afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});
```

## File Structure

Create:

- `apps/portal-web/src/app/notifications/notification-lifecycle-storage.service.ts`
- `apps/portal-web/src/app/notifications/notification-lifecycle-storage.service.spec.ts`
- `apps/portal-web-e2e/src/notifications-lifecycle.spec.ts`

Modify:

- `apps/portal-web/src/app/store/notification-signal.store.ts`
- `apps/portal-web/src/app/store/notification-signal.store.spec.ts`
- `apps/portal-web/src/app/notifications/notification-history.service.ts`
- `apps/portal-web/src/app/notifications/notification-history.service.spec.ts`
- `apps/portal-web/src/app/real-time.service.ts`
- `apps/portal-web/src/app/real-time.service.spec.ts`
- `apps/portal-web/src/app/app.ts`
- `apps/portal-web/src/app/app.html`
- `apps/portal-web/src/app/app.spec.ts`
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.types.ts`
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.ts`
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.html`
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.scss`
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.spec.ts`
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.stories.ts`
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.service.ts`
- `libs/ui/design-system/src/lib/molecules/notification-toggle/notification-toggle.component.ts`
- `libs/ui/design-system/src/lib/molecules/notification-toggle/notification-toggle.component.html`
- `libs/ui/design-system/src/lib/molecules/notification-toggle/notification-toggle.spec.ts`
- `libs/ui/design-system/src/lib/molecules/notification-toggle/notification-toggle.stories.ts`

Verification commands:

```bash
CI=true npx nx test portal-web --skip-nx-cache
CI=true npx nx test design-system --skip-nx-cache
CI=true npx nx e2e portal-web-e2e --skip-nx-cache
CI=true npx nx build portal-web --skip-nx-cache
CI=true npx nx build-storybook design-system --skip-nx-cache
```

---

### Task 1: Lifecycle Storage Helper

**Files:**
- Create: `apps/portal-web/src/app/notifications/notification-lifecycle-storage.service.ts`
- Create: `apps/portal-web/src/app/notifications/notification-lifecycle-storage.service.spec.ts`

- [ ] **Step 1: Write failing storage helper tests**

Create `apps/portal-web/src/app/notifications/notification-lifecycle-storage.service.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import {
  encodeNotificationKeySegment,
  NotificationLifecycleRecord,
  NotificationLifecycleStorageService,
} from './notification-lifecycle-storage.service';

describe('NotificationLifecycleStorageService', () => {
  let service: NotificationLifecycleStorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [NotificationLifecycleStorageService],
    });
    service = TestBed.inject(NotificationLifecycleStorageService);
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('encodes dynamic key segments with encodeURIComponent', () => {
    expect(encodeNotificationKeySegment('tenant:1 / west')).toBe('tenant%3A1%20%2F%20west');
    expect(encodeNotificationKeySegment('user/sub 1')).toBe('user%2Fsub%201');
  });

  it('builds scoped storage keys from encoded tenant and OIDC subject', () => {
    expect(service.getScopeKey({ tenantId: 'tenant:1', userId: 'user/sub 1' }))
      .toBe('tai.portal.notifications.lifecycle.v1:tenant%3A1:user%2Fsub%201');
  });

  it('reads empty lifecycle state when scope key is missing', () => {
    expect(service.read({ tenantId: 'tenant-1', userId: 'user-sub-1' })).toEqual({});
  });

  it('reads valid lifecycle records and ignores unknown fields', () => {
    localStorage.setItem(
      'tai.portal.notifications.lifecycle.v1:tenant-1:user-sub-1',
      JSON.stringify({
        'evt-001': {
          readAt: '2026-05-07T18:00:00.000Z',
          acknowledgedAt: '2026-05-07T18:01:00.000Z',
          extra: 'ignored',
        },
      })
    );

    expect(service.read({ tenantId: 'tenant-1', userId: 'user-sub-1' })).toEqual({
      'evt-001': {
        readAt: '2026-05-07T18:00:00.000Z',
        acknowledgedAt: '2026-05-07T18:01:00.000Z',
      },
    });
  });

  it('rejects malformed JSON and non-object roots as empty state', () => {
    localStorage.setItem('tai.portal.notifications.lifecycle.v1:tenant-1:user-sub-1', '{bad json');
    expect(service.read({ tenantId: 'tenant-1', userId: 'user-sub-1' })).toEqual({});

    localStorage.setItem('tai.portal.notifications.lifecycle.v1:tenant-1:user-sub-1', JSON.stringify([]));
    expect(service.read({ tenantId: 'tenant-1', userId: 'user-sub-1' })).toEqual({});
  });

  it('preserves valid sibling records when one record is invalid', () => {
    localStorage.setItem(
      'tai.portal.notifications.lifecycle.v1:tenant-1:user-sub-1',
      JSON.stringify({
        'evt-001': { readAt: '2026-05-07T18:00:00.000Z', acknowledgedAt: null },
        'evt-002': { readAt: 123, acknowledgedAt: null },
        '__proto__': { readAt: '2026-05-07T18:00:00.000Z', acknowledgedAt: null },
        constructor: { readAt: '2026-05-07T18:00:00.000Z', acknowledgedAt: null },
      })
    );

    const result = service.read({ tenantId: 'tenant-1', userId: 'user-sub-1' });
    expect(result).toEqual({
      'evt-001': { readAt: '2026-05-07T18:00:00.000Z', acknowledgedAt: null },
    });
    expect(Object.prototype.polluted).toBeUndefined();
  });

  it('writes records and keeps only the latest 1500 event IDs', () => {
    const records: Record<string, NotificationLifecycleRecord> = {};
    const retainedEventIds: string[] = [];

    for (let i = 0; i < 1501; i += 1) {
      const id = `evt-${i.toString().padStart(4, '0')}`;
      records[id] = { readAt: '2026-05-07T18:00:00.000Z', acknowledgedAt: null };
      retainedEventIds.push(id);
    }

    service.write(
      { tenantId: 'tenant-1', userId: 'user-sub-1' },
      records,
      retainedEventIds
    );

    const stored = service.read({ tenantId: 'tenant-1', userId: 'user-sub-1' });
    expect(Object.keys(stored)).toHaveLength(1500);
    expect(stored['evt-0000']).toBeUndefined();
    expect(stored['evt-1500']).toEqual({ readAt: '2026-05-07T18:00:00.000Z', acknowledgedAt: null });
  });

  it('keeps at most 10 most-recently-used lifecycle scope keys', () => {
    for (let i = 0; i < 11; i += 1) {
      service.write(
        { tenantId: `tenant-${i}`, userId: `user-${i}` },
        { [`evt-${i}`]: { readAt: '2026-05-07T18:00:00.000Z', acknowledgedAt: null } },
        [`evt-${i}`]
      );
    }

    const index = JSON.parse(localStorage.getItem('tai.portal.notifications.lifecycle.scopes.v1') ?? '[]');
    expect(index).toHaveLength(10);
    expect(index[0]).toBe('tai.portal.notifications.lifecycle.v1:tenant-10:user-10');
    expect(index).not.toContain('tai.portal.notifications.lifecycle.v1:tenant-0:user-0');
    expect(localStorage.getItem('tai.portal.notifications.lifecycle.v1:tenant-0:user-0')).toBeNull();
  });

  it('does not throw when localStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });

    expect(() => service.read({ tenantId: 'tenant-1', userId: 'user-sub-1' })).not.toThrow();
    expect(() => service.write(
      { tenantId: 'tenant-1', userId: 'user-sub-1' },
      { 'evt-001': { readAt: '2026-05-07T18:00:00.000Z', acknowledgedAt: null } },
      ['evt-001']
    )).not.toThrow();
  });
});
```

- [ ] **Step 2: Run storage tests and verify they fail**

Run:

```bash
CI=true npx nx test portal-web --skip-nx-cache --testFile=apps/portal-web/src/app/notifications/notification-lifecycle-storage.service.spec.ts
```

Expected: FAIL because `notification-lifecycle-storage.service.ts` does not exist.

- [ ] **Step 3: Implement lifecycle storage helper**

Create `apps/portal-web/src/app/notifications/notification-lifecycle-storage.service.ts`:

```typescript
import { Injectable } from '@angular/core';

export interface NotificationLifecycleScope {
  tenantId: string;
  userId: string;
}

export interface NotificationLifecycleRecord {
  readAt: string | null;
  acknowledgedAt: string | null;
}

export type NotificationLifecycleRecords = Record<string, NotificationLifecycleRecord>;

const STORAGE_PREFIX = 'tai.portal.notifications.lifecycle.v1';
const SCOPE_INDEX_KEY = 'tai.portal.notifications.lifecycle.scopes.v1';
const MAX_SCOPE_COUNT = 10;
export const MAX_LIFECYCLE_RECORDS_PER_SCOPE = 1500;

const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export function encodeNotificationKeySegment(value: string): string {
  return encodeURIComponent(String(value));
}

function isValidIsoDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function isValidTimestampOrNull(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && isValidIsoDate(value));
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable({ providedIn: 'root' })
export class NotificationLifecycleStorageService {
  getScopeKey(scope: NotificationLifecycleScope): string {
    return `${STORAGE_PREFIX}:${encodeNotificationKeySegment(scope.tenantId)}:${encodeNotificationKeySegment(scope.userId)}`;
  }

  read(scope: NotificationLifecycleScope): NotificationLifecycleRecords {
    const key = this.getScopeKey(scope);

    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return {};
      }

      const parsed = JSON.parse(raw) as unknown;
      if (!isPlainRecord(parsed)) {
        return {};
      }

      const result: NotificationLifecycleRecords = {};
      for (const [eventId, value] of Object.entries(parsed)) {
        if (DANGEROUS_KEYS.has(eventId) || !isPlainRecord(value)) {
          continue;
        }

        const readAt = value['readAt'];
        const acknowledgedAt = value['acknowledgedAt'];

        if (!isValidTimestampOrNull(readAt) || !isValidTimestampOrNull(acknowledgedAt)) {
          continue;
        }

        result[eventId] = { readAt, acknowledgedAt };
      }

      return result;
    } catch {
      return {};
    }
  }

  write(
    scope: NotificationLifecycleScope,
    records: NotificationLifecycleRecords,
    retainedEventIds: string[]
  ): void {
    const key = this.getScopeKey(scope);
    const retainedWindow = retainedEventIds.slice(-MAX_LIFECYCLE_RECORDS_PER_SCOPE);
    const pruned: NotificationLifecycleRecords = {};

    for (const eventId of retainedWindow) {
      if (DANGEROUS_KEYS.has(eventId)) {
        continue;
      }

      const record = records[eventId];
      if (record) {
        pruned[eventId] = record;
      }
    }

    try {
      localStorage.setItem(key, JSON.stringify(pruned));
      this.touchScopeKey(key);
    } catch {
      return;
    }
  }

  private touchScopeKey(key: string): void {
    const existing = this.readScopeIndex().filter(item => item !== key);
    const next = [key, ...existing].slice(0, MAX_SCOPE_COUNT);
    const removed = existing.slice(MAX_SCOPE_COUNT - 1);

    try {
      for (const removedKey of removed) {
        localStorage.removeItem(removedKey);
      }
      localStorage.setItem(SCOPE_INDEX_KEY, JSON.stringify(next));
    } catch {
      return;
    }
  }

  private readScopeIndex(): string[] {
    try {
      const raw = localStorage.getItem(SCOPE_INDEX_KEY);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
      return [];
    }
  }
}
```

- [ ] **Step 4: Run storage tests and verify they pass**

Run:

```bash
CI=true npx nx test portal-web --skip-nx-cache --testFile=apps/portal-web/src/app/notifications/notification-lifecycle-storage.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit storage helper**

```bash
git add apps/portal-web/src/app/notifications/notification-lifecycle-storage.service.ts apps/portal-web/src/app/notifications/notification-lifecycle-storage.service.spec.ts
git commit -m "feat(notifications): add lifecycle storage helper"
```

---

### Task 2: Notification Store Lifecycle State

**Files:**
- Modify: `apps/portal-web/src/app/store/notification-signal.store.ts`
- Modify: `apps/portal-web/src/app/store/notification-signal.store.spec.ts`

- [ ] **Step 1: Write failing store lifecycle tests**

Add these imports to `apps/portal-web/src/app/store/notification-signal.store.spec.ts`:

```typescript
import { NotificationLifecycleStorageService } from '../notifications/notification-lifecycle-storage.service';
```

Add this `describe` block near the existing tenant-scoped idempotency tests:

```typescript
describe('lifecycle state', () => {
  let storage: NotificationLifecycleStorageService;

  beforeEach(() => {
    storage = TestBed.inject(NotificationLifecycleStorageService);
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-07T18:00:00.000Z'));
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function notification(id: string, severity: 'critical' | 'warning' | 'info' = 'critical'): NotificationItem {
    return {
      ...mockNotification,
      id,
      tenantId: 'tenant-1',
      severity,
      readAt: null,
      acknowledgedAt: null,
    };
  }

  it('encodes idempotency key segments and avoids colon collisions', () => {
    expect(getNotificationIdempotencyKey({ tenantId: 'tenant:1', id: 'evt-1' }))
      .toBe('tenant%3A1:evt-1');
    expect(getNotificationIdempotencyKey({ tenantId: 'tenant', id: '1:evt-1' }))
      .toBe('tenant:1%3Aevt-1');
    expect(getNotificationIdempotencyKey({ tenantId: 'tenant:1', id: 'evt-1' }))
      .not.toBe(getNotificationIdempotencyKey({ tenantId: 'tenant', id: '1:evt-1' }));
  });

  it('keeps safe idempotency keys stable while fixing unsafe segment collisions', () => {
    expect(getNotificationIdempotencyKey({ tenantId: 'tenant-1', id: 'evt-1' }))
      .toBe('tenant-1:evt-1');
  });

  it('overlays persisted lifecycle state when adding notifications', () => {
    storage.write(
      { tenantId: 'tenant-1', userId: 'user-sub-1' },
      { 'evt-001': { readAt: '2026-05-07T17:00:00.000Z', acknowledgedAt: '2026-05-07T17:05:00.000Z' } },
      ['evt-001']
    );

    store.setLifecycleScope({ tenantId: 'tenant-1', userId: 'user-sub-1' });
    store.addNotification(notification('evt-001'));

    expect(store.notifications()[0].readAt).toBe('2026-05-07T17:00:00.000Z');
    expect(store.notifications()[0].acknowledgedAt).toBe('2026-05-07T17:05:00.000Z');
  });

  it('does not create notifications from fabricated lifecycle records', () => {
    storage.write(
      { tenantId: 'tenant-1', userId: 'user-sub-1' },
      { 'evt-fake': { readAt: '2026-05-07T17:00:00.000Z', acknowledgedAt: null } },
      ['evt-fake']
    );

    store.setLifecycleScope({ tenantId: 'tenant-1', userId: 'user-sub-1' });

    expect(store.notifications()).toEqual([]);
  });

  it('marks one notification read without replacing existing readAt', () => {
    store.setLifecycleScope({ tenantId: 'tenant-1', userId: 'user-sub-1' });
    store.addNotification(notification('evt-001'));

    store.markRead('evt-001');
    store.markRead('evt-001');

    expect(store.notifications()[0].readAt).toBe('2026-05-07T18:00:00.000Z');
    expect(store.unreadCount()).toBe(0);
    expect(store.hasUnread()).toBe(false);
  });

  it('marks all retained notifications read', () => {
    store.setLifecycleScope({ tenantId: 'tenant-1', userId: 'user-sub-1' });
    store.addNotifications([notification('evt-001'), notification('evt-002', 'warning')]);

    store.markAllRead();

    expect(store.notifications().every(item => item.readAt === '2026-05-07T18:00:00.000Z')).toBe(true);
    expect(store.unreadCount()).toBe(0);
  });

  it('acknowledges critical notifications and marks them read', () => {
    store.setLifecycleScope({ tenantId: 'tenant-1', userId: 'user-sub-1' });
    store.addNotification(notification('evt-001', 'critical'));

    store.acknowledge('evt-001');

    expect(store.notifications()[0].acknowledgedAt).toBe('2026-05-07T18:00:00.000Z');
    expect(store.notifications()[0].readAt).toBe('2026-05-07T18:00:00.000Z');
    expect(store.criticalUnacknowledgedCount()).toBe(0);
  });

  it('does not acknowledge warning or info notifications', () => {
    store.setLifecycleScope({ tenantId: 'tenant-1', userId: 'user-sub-1' });
    store.addNotifications([notification('evt-warning', 'warning'), notification('evt-info', 'info')]);

    store.acknowledge('evt-warning');
    store.acknowledge('evt-info');

    expect(store.notifications().every(item => item.acknowledgedAt === null)).toBe(true);
  });

  it('updates memory even when lifecycle scope is missing', () => {
    store.addNotification(notification('evt-001'));

    store.markRead('evt-001');

    expect(store.notifications()[0].readAt).toBe('2026-05-07T18:00:00.000Z');
    expect(localStorage.length).toBe(0);
  });

  it('preserves lifecycle state through duplicate history and SignalR arrivals', () => {
    store.setLifecycleScope({ tenantId: 'tenant-1', userId: 'user-sub-1' });
    store.addNotification(notification('evt-001'));
    store.markRead('evt-001');

    store.addNotification({ ...notification('evt-001'), source: 'history' });

    expect(store.notifications()).toHaveLength(1);
    expect(store.notifications()[0].readAt).toBe('2026-05-07T18:00:00.000Z');
  });

  it('reapplies lifecycle state after idempotency eviction while within lifecycle retention', () => {
    store.setLifecycleScope({ tenantId: 'tenant-1', userId: 'user-sub-1' });
    store.addNotification(notification('evt-0000'));
    store.markRead('evt-0000');

    for (let i = 1; i <= 1000; i += 1) {
      store.addNotification(notification(`evt-${i.toString().padStart(4, '0')}`));
    }

    store.addNotification(notification('evt-0000'));

    expect(store.notifications()[0].id).toBe('evt-0000');
    expect(store.notifications()[0].readAt).toBe('2026-05-07T18:00:00.000Z');
  });

  it('keeps lifecycle event retention queue bounded to 1500 ids', () => {
    store.setLifecycleScope({ tenantId: 'tenant-1', userId: 'user-sub-1' });

    for (let i = 0; i < 1501; i += 1) {
      const id = `evt-${i.toString().padStart(4, '0')}`;
      store.addNotification(notification(id));
      store.markRead(id);
    }

    const stored = storage.read({ tenantId: 'tenant-1', userId: 'user-sub-1' });
    expect(Object.keys(stored)).toHaveLength(1500);
    expect(stored['evt-0000']).toBeUndefined();
    expect(stored['evt-1500']?.readAt).toBe('2026-05-07T18:00:00.000Z');
  });

  it('clears active lifecycle scope on auth boundary without deleting persisted records', () => {
    store.setLifecycleScope({ tenantId: 'tenant-1', userId: 'user-sub-1' });
    store.addNotification(notification('evt-001'));
    store.markRead('evt-001');

    store.clearForAuthBoundaryChange();
    store.addNotification(notification('evt-001'));

    expect(store.notifications()[0].readAt).toBeNull();

    store.setLifecycleScope({ tenantId: 'tenant-1', userId: 'user-sub-1' });
    store.clearNotifications();
    store.addNotification(notification('evt-001'));

    expect(store.notifications()[0].readAt).toBe('2026-05-07T18:00:00.000Z');
  });
});
```

- [ ] **Step 2: Run store tests and verify they fail**

Run:

```bash
CI=true npx nx test portal-web --skip-nx-cache --testFile=apps/portal-web/src/app/store/notification-signal.store.spec.ts
```

Expected: FAIL because lifecycle methods/signals and encoded idempotency do not exist.

- [ ] **Step 3: Implement store lifecycle state**

Update `apps/portal-web/src/app/store/notification-signal.store.ts` with these changes:

```typescript
import { Injectable, signal, computed, inject } from '@angular/core';
import {
  encodeNotificationKeySegment,
  NotificationLifecycleRecords,
  NotificationLifecycleScope,
  NotificationLifecycleStorageService,
} from '../notifications/notification-lifecycle-storage.service';
```

Replace `getNotificationIdempotencyKey()` with:

```typescript
export { encodeNotificationKeySegment };

export function getNotificationIdempotencyKey(notification: Pick<NotificationItem, 'tenantId' | 'id'>): string {
  return `${encodeNotificationKeySegment(notification.tenantId)}:${encodeNotificationKeySegment(notification.id)}`;
}
```

Add private fields and computed signals inside `NotificationSignalStore`:

```typescript
private readonly lifecycleStorage = inject(NotificationLifecycleStorageService);
private readonly _lifecycleScope = signal<NotificationLifecycleScope | null>(null);
private lifecycleRecords: NotificationLifecycleRecords = {};
private readonly lifecycleEventIdQueue: string[] = [];

readonly unreadCount = computed(() => this._notifications().filter(item => item.readAt === null).length);
readonly hasUnread = computed(() => this.unreadCount() > 0);
readonly criticalUnacknowledgedCount = computed(() =>
  this._notifications().filter(item => item.severity === 'critical' && item.acknowledgedAt === null).length
);
```

Add the same retention constant used by the storage helper:

```typescript
const MAX_LIFECYCLE_EVENT_QUEUE = 1500;
```

Add public lifecycle methods:

```typescript
setLifecycleScope(scope: NotificationLifecycleScope | null): void {
  this._lifecycleScope.set(scope);
  this.lifecycleRecords = scope ? this.lifecycleStorage.read(scope) : {};
}

markRead(eventId: string): void {
  const existing = this._notifications().find(item => item.id === eventId);
  if (!existing || existing.readAt) {
    return;
  }

  const readAt = new Date().toISOString();
  this._notifications.update(items =>
    items.map(item => item.id === eventId ? { ...item, readAt } : item)
  );
  this.updateLifecycleRecord(eventId, { readAt });
}

markAllRead(): void {
  const readAt = new Date().toISOString();
  const unreadIds: string[] = [];

  this._notifications.update(items => items.map(item => {
    if (item.readAt) {
      return item;
    }

    unreadIds.push(item.id);
    return { ...item, readAt };
  }));

  for (const id of unreadIds) {
    this.updateLifecycleRecord(id, { readAt }, false);
  }
  this.persistLifecycle();
}

acknowledge(eventId: string): void {
  const existing = this._notifications().find(item => item.id === eventId);
  if (!existing || existing.severity !== 'critical' || existing.acknowledgedAt) {
    return;
  }

  const acknowledgedAt = new Date().toISOString();
  const readAt = existing.readAt ?? acknowledgedAt;
  this._notifications.update(items =>
    items.map(item => item.id === eventId ? { ...item, readAt, acknowledgedAt } : item)
  );
  this.updateLifecycleRecord(eventId, { readAt, acknowledgedAt });
}
```

Change `addNotifications()` so it overlays lifecycle records before adding:

```typescript
addNotifications(notifications: NotificationItem[]): void {
  const uniqueNotifications: NotificationItem[] = [];

  for (const notification of notifications) {
    const key = getNotificationIdempotencyKey(notification);
    if (this.seenNotificationKeys.has(key)) {
      continue;
    }

    this.trackSeenKey(key);
    this.trackLifecycleEventId(notification.id);
    uniqueNotifications.push(this.applyLifecycle(notification));
  }

  if (uniqueNotifications.length === 0) {
    return;
  }

  this._notifications.update(buffer =>
    [...uniqueNotifications, ...buffer]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, MAX_BUFFER_SIZE)
  );
}
```

Add private lifecycle helpers:

```typescript
private applyLifecycle(notification: NotificationItem): NotificationItem {
  const record = this.lifecycleRecords[notification.id];
  if (!record) {
    return notification;
  }

  return {
    ...notification,
    readAt: record.readAt,
    acknowledgedAt: notification.severity === 'critical' ? record.acknowledgedAt : null,
  };
}

private updateLifecycleRecord(
  eventId: string,
  patch: Partial<{ readAt: string; acknowledgedAt: string }>,
  persist = true
): void {
  const current = this.lifecycleRecords[eventId] ?? { readAt: null, acknowledgedAt: null };
  this.lifecycleRecords = {
    ...this.lifecycleRecords,
    [eventId]: {
      readAt: patch.readAt ?? current.readAt,
      acknowledgedAt: patch.acknowledgedAt ?? current.acknowledgedAt,
    },
  };
  this.trackLifecycleEventId(eventId);

  if (persist) {
    this.persistLifecycle();
  }
}

private persistLifecycle(): void {
  const scope = this._lifecycleScope();
  if (!scope) {
    return;
  }

  this.lifecycleStorage.write(scope, this.lifecycleRecords, this.lifecycleEventIdQueue);
}

private trackLifecycleEventId(eventId: string): void {
  const existingIndex = this.lifecycleEventIdQueue.indexOf(eventId);
  if (existingIndex >= 0) {
    this.lifecycleEventIdQueue.splice(existingIndex, 1);
  }
  this.lifecycleEventIdQueue.push(eventId);

  while (this.lifecycleEventIdQueue.length > MAX_LIFECYCLE_EVENT_QUEUE) {
    const evicted = this.lifecycleEventIdQueue.shift();
    if (evicted) {
      delete this.lifecycleRecords[evicted];
    }
  }
}
```

Update `clearForAuthBoundaryChange()` and ensure lifecycle memory is cleared when scope is cleared:

```typescript
setLifecycleScope(scope: NotificationLifecycleScope | null): void {
  this._lifecycleScope.set(scope);
  this.lifecycleRecords = scope ? this.lifecycleStorage.read(scope) : {};
  this.lifecycleEventIdQueue.length = 0;

  if (scope) {
    this.lifecycleEventIdQueue.push(...Object.keys(this.lifecycleRecords).slice(-MAX_LIFECYCLE_EVENT_QUEUE));
  }
}

clearForAuthBoundaryChange(): void {
  this.clearNotifications();
  this.setLifecycleScope(null);
  this._isHydrating.set(false);
  this._hydrationError.set(null);
  this._hasHydrated.set(false);
}
```

- [ ] **Step 4: Run store tests and verify they pass**

Run:

```bash
CI=true npx nx test portal-web --skip-nx-cache --testFile=apps/portal-web/src/app/store/notification-signal.store.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit store lifecycle**

```bash
git add apps/portal-web/src/app/store/notification-signal.store.ts apps/portal-web/src/app/store/notification-signal.store.spec.ts
git commit -m "feat(notifications): add lifecycle state to store"
```

---

### Task 3: Auth Scope Wiring in History Hydration

**Files:**
- Modify: `apps/portal-web/src/app/notifications/notification-history.service.ts`
- Modify: `apps/portal-web/src/app/notifications/notification-history.service.spec.ts`

- [ ] **Step 1: Write failing history service scope tests**

In `apps/portal-web/src/app/notifications/notification-history.service.spec.ts`, add tests that expect lifecycle scope setup. Use the existing test setup with `BehaviorSubject<User | null>` and mocked store.

Add these store mock members:

```typescript
setLifecycleScope: vi.fn(),
markRead: vi.fn(),
markAllRead: vi.fn(),
acknowledge: vi.fn(),
```

Add tests:

```typescript
it('sets lifecycle scope from tenantId and OIDC subject before hydration rows are added', fakeAsync(() => {
  http.get.mockReturnValue(of([auditRow]));
  instantiateService();

  user$.next({ ...adminUser, id: 'user-sub-1', tenantId: 'tenant-1', email: 'changed@tai.com' });
  tick();

  expect(store.setLifecycleScope).toHaveBeenCalledWith({ tenantId: 'tenant-1', userId: 'user-sub-1' });
  expect(store.setLifecycleScope.mock.invocationCallOrder[0])
    .toBeLessThan(store.addNotifications.mock.invocationCallOrder[0]);
}));

it('clears lifecycle scope on logout', fakeAsync(() => {
  http.get.mockReturnValue(of([]));
  instantiateService();

  user$.next({ ...adminUser, id: 'user-sub-1', tenantId: 'tenant-1' });
  tick();
  user$.next(null);
  tick();

  expect(store.clearForAuthBoundaryChange).toHaveBeenCalled();
  expect(store.setLifecycleScope).toHaveBeenCalledWith(null);
}));

it('switches tenant scope and rehydrates when switching back to the original tenant', fakeAsync(() => {
  http.get.mockReturnValue(of([]));
  instantiateService();

  user$.next({ ...adminUser, id: 'user-sub-1', tenantId: 'tenant-1' });
  tick();
  user$.next({ ...adminUser, id: 'user-sub-1', tenantId: 'tenant-2' });
  tick();
  user$.next({ ...adminUser, id: 'user-sub-1', tenantId: 'tenant-1' });
  tick();

  expect(store.setLifecycleScope).toHaveBeenCalledWith({ tenantId: 'tenant-1', userId: 'user-sub-1' });
  expect(store.setLifecycleScope).toHaveBeenCalledWith({ tenantId: 'tenant-2', userId: 'user-sub-1' });
  expect(http.get).toHaveBeenCalledTimes(3);
}));
```

- [ ] **Step 2: Run history service tests and verify they fail**

Run:

```bash
CI=true npx nx test portal-web --skip-nx-cache --testFile=apps/portal-web/src/app/notifications/notification-history.service.spec.ts
```

Expected: FAIL because the service currently maps `user$` to tenant ID and drops `User.id`.

- [ ] **Step 3: Implement scope-aware hydration pipeline**

Update `apps/portal-web/src/app/notifications/notification-history.service.ts`.

Replace `currentTenantId` with:

```typescript
private currentUser: Pick<User, 'id' | 'tenantId'> | null = null;
```

Replace the constructor `user$` pipeline with:

```typescript
this.authService.user$.pipe(
  takeUntilDestroyed(this.destroyRef),
  tap(user => this.handleAuthBoundary(user)),
  filter((user): user is User => !!user && !!user.tenantId && !!user.id),
  filter(user => !this.hydratedTenants.has(this.getHydrationKey(user))),
  switchMap(user => this.hydrateTenant(user.tenantId!, user.id))
).subscribe();
```

Update retry logic:

```typescript
switchMap(() => {
  const user = this.currentUser;
  if (!user?.tenantId || !user.id) {
    this.store.setHydrating(false);
    this.store.setHydrationError('Unable to verify notification tenant.');
    return EMPTY;
  }
  const hydrationKey = this.getHydrationKey({ tenantId: user.tenantId, id: user.id });
  if (!this.canRetry(hydrationKey)) {
    this.store.setHydrationError('Retry limit reached. Try again shortly.');
    return EMPTY;
  }
  this.hydratedTenants.delete(hydrationKey);
  return this.hydrateTenant(user.tenantId, user.id);
})
```

Replace `handleTenantBoundary()` with:

```typescript
private handleAuthBoundary(user: User | null): void {
  const previousKey = this.currentUser?.tenantId && this.currentUser?.id
    ? this.getHydrationKey({ tenantId: this.currentUser.tenantId, id: this.currentUser.id })
    : null;
  const nextKey = user?.tenantId && user?.id
    ? this.getHydrationKey({ tenantId: user.tenantId, id: user.id })
    : null;

  this.currentUser = user ? { id: user.id, tenantId: user.tenantId } : null;

  if (previousKey !== null && previousKey !== nextKey) {
    this.store.clearForAuthBoundaryChange();
    this.store.setLifecycleScope(null);
    this.hydratedTenants.delete(previousKey);
  }

  if (previousKey !== nextKey) {
    this.retryAttemptsByTenant.clear();
  }

  if (!user?.tenantId || !user.id) {
    this.store.setLifecycleScope(null);
    this.store.setHydrating(false);
    this.store.setHydrationError('Unable to verify notification tenant.');
    return;
  }

  this.store.setLifecycleScope({ tenantId: user.tenantId, userId: user.id });
}

private getHydrationKey(user: Pick<User, 'tenantId' | 'id'>): string {
  return `${user.tenantId}:${user.id}`;
}
```

Change `hydrateTenant()` and `applyHydrationRows()` signatures:

```typescript
private hydrateTenant(tenantId: string, userId: string) {
  this.store.setHydrating(true);
  this.store.setHydrationError(null);

  return this.http.get<AuditLogDetails[]>(`/api/AuditLogs/recent?limit=${RECENT_LIMIT}`, { withCredentials: true }).pipe(
    timeout(HYDRATION_TIMEOUT_MS),
    tap(rows => this.applyHydrationRows(rows, tenantId, userId)),
    catchError(error => {
      this.store.setHydrationError(this.mapHydrationError(error));
      this.store.setHydrating(false);
      return EMPTY;
    })
  );
}

private applyHydrationRows(rows: AuditLogDetails[], expectedTenantId: string, expectedUserId: string): void {
  if (this.currentUser?.tenantId !== expectedTenantId || this.currentUser.id !== expectedUserId) {
    return;
  }

  const mapped = rows
    .map(row => mapAuditLogToNotification(row, {
      source: 'history',
      expectedEventId: row.id,
      expectedTenantId,
    }))
    .filter(notification => notification !== null);

  if (rows.length > 0 && mapped.length === 0) {
    this.store.setHydrationError('Unable to load recent notifications');
    this.store.setHydrating(false);
    return;
  }

  this.store.addNotifications(mapped);
  this.store.markHydrated();
  this.store.setHydrationError(null);
  this.store.setHydrating(false);

  if (this.currentUser?.tenantId === expectedTenantId && this.currentUser.id === expectedUserId) {
    this.hydratedTenants.add(this.getHydrationKey({ tenantId: expectedTenantId, id: expectedUserId }));
  }
}
```

- [ ] **Step 4: Run history service tests**

Run:

```bash
CI=true npx nx test portal-web --skip-nx-cache --testFile=apps/portal-web/src/app/notifications/notification-history.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit history scope wiring**

```bash
git add apps/portal-web/src/app/notifications/notification-history.service.ts apps/portal-web/src/app/notifications/notification-history.service.spec.ts
git commit -m "feat(notifications): scope lifecycle hydration by user"
```

---

### Task 4: Real-Time Service Cleanup

**Files:**
- Modify: `apps/portal-web/src/app/real-time.service.ts`
- Modify: `apps/portal-web/src/app/real-time.service.spec.ts`

- [ ] **Step 1: Write failing real-time tests**

In `apps/portal-web/src/app/real-time.service.spec.ts`, add tests for no unread service coupling and no payload logging. Use existing service construction helpers.

```typescript
it('adds SignalR notification without updating NotificationPanelService unread count', async () => {
  const setUnreadSpy = vi.spyOn(panelService, 'setUnreadCount');
  http.get.mockReturnValue(of(auditDetails));
  user$.next({ id: 'user-sub-1', name: 'Admin', email: 'admin@tai.com', tenantId: 'tenant-1', roles: ['Admin'], privileges: [] });

  await (service as any).handleSecurityEvent({ eventId: 'event-123', eventType: 'PrivilegeModified' });

  expect(store.addNotification).toHaveBeenCalled();
  expect(setUnreadSpy).not.toHaveBeenCalled();
});

it('does not log security event payloads, audit details, notifications, event IDs, or error objects', async () => {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  http.get.mockReturnValue(throwError(() => new Error('contains-event-123')));
  user$.next({ id: 'user-sub-1', name: 'Admin', email: 'admin@tai.com', tenantId: 'tenant-1', roles: ['Admin'], privileges: [] });

  await (service as any).handleSecurityEvent({
    eventId: 'event-123',
    eventType: 'PrivilegeModified',
    reason: 'sensitive reason',
    tenantId: 'tenant-1',
  });

  const serialized = JSON.stringify([
    logSpy.mock.calls,
    warnSpy.mock.calls,
    errorSpy.mock.calls,
  ]);

  expect(serialized).not.toContain('event-123');
  expect(serialized).not.toContain('tenant-1');
  expect(serialized).not.toContain('sensitive reason');
  expect(serialized).not.toContain('contains-event-123');
});
```

- [ ] **Step 2: Run real-time tests and verify they fail**

Run:

```bash
CI=true npx nx test portal-web --skip-nx-cache --testFile=apps/portal-web/src/app/real-time.service.spec.ts
```

Expected: FAIL because current code logs payloads/details and calls `panelService.setUnreadCount()`.

- [ ] **Step 3: Remove payload logging and unread-count coupling**

Update `apps/portal-web/src/app/real-time.service.ts`:

- Remove `NotificationPanelService` from imports and injected fields.
- Remove all `console.log()` calls inside `SecurityEvent` handling and `handleSecurityEvent()`.
- Keep only static lifecycle messages if needed. Do not concatenate raw `err`.
- Remove `this.panelService.setUnreadCount(this.store.eventBuffer().length);`.

The key block inside `this.ngZone.run()` should become:

```typescript
this.ngZone.run(() => {
  this.store.addNotification(notification);

  if (notification.severity === 'critical') {
    this.toastService.show(
      notification.title,
      'critical'
    );
  }
});
```

The catch block should become:

```typescript
} catch {
  this.toastService.show(
    NOTIFICATION_TOAST_MESSAGES.loadFailed,
    'warning'
  );
}
```

If retaining startup failure logging, use:

```typescript
.catch(() => {
  this._connectionStatus$.next(HubConnectionState.Disconnected);
  console.error('RealTimeService: Error while starting connection');
});
```

The existing privilege-change warning may remain unchanged because it is static and contains no event payload:

```typescript
console.warn('RealTimeService: Privileges have changed. Triggering re-authentication.');
```

- [ ] **Step 4: Run real-time tests**

Run:

```bash
CI=true npx nx test portal-web --skip-nx-cache --testFile=apps/portal-web/src/app/real-time.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit real-time cleanup**

```bash
git add apps/portal-web/src/app/real-time.service.ts apps/portal-web/src/app/real-time.service.spec.ts
git commit -m "fix(notifications): sanitize realtime event handling"
```

---

### Task 5: Notification Panel Lifecycle UI

**Files:**
- Modify: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.types.ts`
- Modify: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.ts`
- Modify: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.html`
- Modify: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.scss`
- Modify: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.spec.ts`
- Modify: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.stories.ts`

- [ ] **Step 1: Write failing panel tests**

Update panel fixtures in `notification-panel.spec.ts` to include lifecycle fields:

```typescript
readAt: null,
acknowledgedAt: null,
```

Add tests:

```typescript
it('renders unread marker and emits markRead for unread notifications', () => {
  const markReadSpy = vi.spyOn(component.markRead, 'emit');
  component.notifications = [{ ...mockNotifications[0], readAt: null, acknowledgedAt: null }];
  panelService.open();
  fixture.detectChanges();

  const unread = fixture.nativeElement.querySelector('[aria-label="Unread notification"]');
  const button = fixture.nativeElement.querySelector('button[type="button"][aria-label="Mark notification as read"]');

  expect(unread).toBeTruthy();
  button.click();
  expect(markReadSpy).toHaveBeenCalledWith('1');
});

it('renders read state without mark-read action', () => {
  component.notifications = [{
    ...mockNotifications[0],
    readAt: '2026-05-07T18:00:00.000Z',
    acknowledgedAt: null,
  }];
  panelService.open();
  fixture.detectChanges();

  expect(fixture.nativeElement.querySelector('[aria-label="Read notification"]')).toBeTruthy();
  expect(fixture.nativeElement.querySelector('button[aria-label="Mark notification as read"]')).toBeNull();
});

it('emits markAllRead only when unread notifications exist', () => {
  const markAllSpy = vi.spyOn(component.markAllRead, 'emit');
  component.notifications = mockNotifications.map(item => ({ ...item, readAt: null, acknowledgedAt: null }));
  panelService.open();
  fixture.detectChanges();

  const button = fixture.nativeElement.querySelector('button[type="button"][aria-label="Mark all notifications as read"]');
  expect(button.disabled).toBe(false);
  button.click();
  expect(markAllSpy).toHaveBeenCalled();
});

it('renders acknowledgement control only for unacknowledged critical notifications', () => {
  const ackSpy = vi.spyOn(component.acknowledge, 'emit');
  component.notifications = [
    { ...mockNotifications[0], severity: 'critical', readAt: null, acknowledgedAt: null },
    { ...mockNotifications[1], severity: 'warning', readAt: null, acknowledgedAt: null },
  ];
  panelService.open();
  fixture.detectChanges();

  expect(fixture.nativeElement.querySelector('[aria-label="Acknowledgement required"]')).toBeTruthy();
  const ackButton = fixture.nativeElement.querySelector('button[type="button"][aria-label="Acknowledge critical notification"]');
  ackButton.click();
  expect(ackSpy).toHaveBeenCalledWith('1');
  expect(fixture.nativeElement.querySelectorAll('button[aria-label="Acknowledge critical notification"]')).toHaveLength(1);
});
```

- [ ] **Step 2: Run panel tests and verify they fail**

Run:

```bash
CI=true npx nx test design-system --skip-nx-cache --testFile=libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.spec.ts
```

Expected: FAIL because `NotificationPanelItem` lacks lifecycle fields and outputs are missing.

- [ ] **Step 3: Extend types and component API**

Update `notification-panel.types.ts`:

```typescript
export interface NotificationPanelItem {
  id: string;
  title: string;
  summary: string | null;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  actor: string;
  timestamp: string;
  userId?: string | null;
  readAt: string | null;
  acknowledgedAt: string | null;
}
```

Update `notification-panel.component.ts`:

```typescript
@Output() markRead = new EventEmitter<string>();
@Output() markAllRead = new EventEmitter<void>();
@Output() acknowledge = new EventEmitter<string>();

readonly hasUnread = (): boolean => this.notifications.some(notification => notification.readAt === null);

onMarkRead(notification: NotificationPanelItem): void {
  if (notification.readAt) {
    return;
  }
  this.markRead.emit(notification.id);
}

onMarkAllRead(): void {
  if (!this.hasUnread()) {
    return;
  }
  this.markAllRead.emit();
}

onAcknowledge(notification: NotificationPanelItem): void {
  if (notification.severity !== 'critical' || notification.acknowledgedAt) {
    return;
  }
  this.acknowledge.emit(notification.id);
}
```

- [ ] **Step 4: Update panel template**

In `notification-panel.component.html`, add a mark-all button in the header actions and lifecycle controls inside each event item. Use this shape:

```html
<button
  type="button"
  class="mark-all-btn"
  aria-label="Mark all notifications as read"
  [disabled]="!hasUnread()"
  (click)="onMarkAllRead()">
  Mark all read
</button>
```

Inside each notification row:

```html
<div class="event-item" [class]="getSeverityClass(notification.severity)" [attr.aria-label]="notification.readAt ? 'Read notification' : 'Unread notification'">
  @if (!notification.readAt) {
    <span class="unread-marker" aria-label="Unread notification"></span>
  } @else {
    <span class="read-marker" aria-label="Read notification"></span>
  }

  <div class="event-content">
    <div class="event-action">{{ notification.title }}</div>
    <div class="event-summary">{{ notification.summary }}</div>
    <div class="event-meta">
      <span class="event-time">{{ formatTime(notification.timestamp) }}</span>
      @if (notification.actor) {
        <span class="event-user">{{ notification.actor }}</span>
      }
      @if (notification.severity === 'critical' && !notification.acknowledgedAt) {
        <span class="ack-required" aria-label="Acknowledgement required">Acknowledgement required</span>
      }
      @if (notification.severity === 'critical' && notification.acknowledgedAt) {
        <span class="acknowledged" aria-label="Acknowledged notification">Acknowledged</span>
      }
    </div>
    <div class="event-actions">
      @if (!notification.readAt) {
        <button type="button" aria-label="Mark notification as read" (click)="onMarkRead(notification)">Mark read</button>
      }
      @if (notification.severity === 'critical' && !notification.acknowledgedAt) {
        <button type="button" aria-label="Acknowledge critical notification" (click)="onAcknowledge(notification)">Acknowledge</button>
      }
    </div>
  </div>
</div>
```

- [ ] **Step 5: Add minimal styles**

In `notification-panel.component.scss`, add:

```scss
.unread-marker,
.read-marker {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
  flex: 0 0 auto;
}

.unread-marker {
  background: #2563eb;
}

.read-marker {
  background: transparent;
  border: 1px solid #9ca3af;
}

.event-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.ack-required {
  color: #b91c1c;
  font-weight: 600;
}

.acknowledged {
  color: #047857;
  font-weight: 600;
}
```

- [ ] **Step 6: Update stories**

In `notification-panel.stories.ts`, ensure all story notifications include `readAt` and `acknowledgedAt`. Add one story with a read item and an acknowledged critical item:

```typescript
export const LifecycleStates: Story = {
  args: {
    notifications: [
      {
        id: 'evt-read',
        title: 'Privilege modified',
        summary: 'Trade approver privilege changed',
        severity: 'critical',
        category: 'privilege',
        actor: 'admin@tai.com',
        timestamp: new Date().toISOString(),
        userId: 'admin@tai.com',
        readAt: '2026-05-07T18:00:00.000Z',
        acknowledgedAt: '2026-05-07T18:01:00.000Z',
      },
    ],
  },
};
```

- [ ] **Step 7: Run panel tests**

Run:

```bash
CI=true npx nx test design-system --skip-nx-cache --testFile=libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit panel lifecycle UI**

```bash
git add libs/ui/design-system/src/lib/organisms/notification-panel
git commit -m "feat(notification-panel): add lifecycle controls"
```

---

### Task 6: Notification Toggle Input Refactor

**Files:**
- Modify: `libs/ui/design-system/src/lib/molecules/notification-toggle/notification-toggle.component.ts`
- Modify: `libs/ui/design-system/src/lib/molecules/notification-toggle/notification-toggle.component.html`
- Modify: `libs/ui/design-system/src/lib/molecules/notification-toggle/notification-toggle.spec.ts`
- Modify: `libs/ui/design-system/src/lib/molecules/notification-toggle/notification-toggle.stories.ts`
- Modify: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.service.ts`

- [ ] **Step 1: Write failing toggle tests**

Replace service-driven unread tests in `notification-toggle.spec.ts` with input-driven tests:

```typescript
it('shows badge from unreadCount input', () => {
  fixture.componentRef.setInput('unreadCount', 5);
  fixture.detectChanges();

  expect(fixture.nativeElement.querySelector('.unread-badge')?.textContent.trim()).toBe('5');
});

it('hides badge when unreadCount input is zero', () => {
  fixture.componentRef.setInput('unreadCount', 0);
  fixture.detectChanges();

  expect(fixture.nativeElement.querySelector('.unread-badge')).toBeNull();
});

it('shows 9+ when unreadCount input is greater than 9', () => {
  fixture.componentRef.setInput('unreadCount', 15);
  fixture.detectChanges();

  expect(fixture.nativeElement.querySelector('.unread-badge')?.textContent.trim()).toBe('9+');
});

it('emits toggled when button is clicked', () => {
  const spy = vi.spyOn(component.toggled, 'emit');

  fixture.nativeElement.querySelector('.toggle-button').click();

  expect(spy).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run toggle tests and verify they fail**

Run:

```bash
CI=true npx nx test design-system --skip-nx-cache --testFile=libs/ui/design-system/src/lib/molecules/notification-toggle/notification-toggle.spec.ts
```

Expected: FAIL because the toggle injects `NotificationPanelService` and has no input/output.

- [ ] **Step 3: Refactor toggle component**

Update `notification-toggle.component.ts`:

```typescript
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'tai-notification-toggle',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-toggle.component.html',
  styleUrl: './notification-toggle.component.scss',
})
export class NotificationToggleComponent {
  @Input() unreadCount = 0;
  @Output() toggled = new EventEmitter<void>();

  toggle(): void {
    this.toggled.emit();
  }

  get displayCount(): string {
    return this.unreadCount > 9 ? '9+' : String(this.unreadCount);
  }

  get showBadge(): boolean {
    return this.unreadCount > 0;
  }
}
```

Update `notification-toggle.component.html`:

```html
<button
  class="toggle-button"
  type="button"
  (click)="toggle()"
  aria-label="Toggle notifications"
>
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
  </svg>

  @if (showBadge) {
    <span class="unread-badge">{{ displayCount }}</span>
  }
</button>
```

- [ ] **Step 4: Deprecate or remove unread methods from panel service**

In `notification-panel.service.ts`, keep panel visibility/filter/search. If keeping compatibility methods, add JSDoc deprecation and do not call them from production code:

```typescript
/**
 * @deprecated Sprint 3 derives unread count from NotificationSignalStore.
 */
setUnreadCount(_count: number): void {
  this._unreadCount.set(0);
}
```

Apply equivalent deprecation to `decrementUnread()` and `markAllAsRead()`, or remove these methods and update tests/imports that referenced them.

- [ ] **Step 5: Update toggle stories**

In `notification-toggle.stories.ts`, provide `unreadCount` args instead of mocking `NotificationPanelService`.

```typescript
export const WithUnread: Story = {
  args: {
    unreadCount: 5,
  },
};
```

- [ ] **Step 6: Run toggle tests**

Run:

```bash
CI=true npx nx test design-system --skip-nx-cache --testFile=libs/ui/design-system/src/lib/molecules/notification-toggle/notification-toggle.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit toggle refactor**

```bash
git add libs/ui/design-system/src/lib/molecules/notification-toggle libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.service.ts
git commit -m "feat(notification-toggle): use unread count input"
```

---

### Task 7: App Wiring and Computed Mapping

**Files:**
- Modify: `apps/portal-web/src/app/app.ts`
- Modify: `apps/portal-web/src/app/app.html`
- Modify: `apps/portal-web/src/app/app.spec.ts`

- [ ] **Step 1: Write failing app integration tests**

In `app.spec.ts`, extend the notification store mock:

```typescript
const notifications = signal([
  {
    id: 'evt-001',
    tenantId: 'tenant-1',
    eventType: 'PrivilegeModified',
    severity: 'critical' as const,
    category: 'privilege' as const,
    title: 'Privilege modified',
    summary: 'Trade approver changed',
    timestamp: '2026-05-07T18:00:00.000Z',
    actor: 'admin@tai.com',
    userId: 'admin@tai.com',
    ipAddress: null,
    resourceId: 'priv-1',
    correlationId: null,
    readAt: '2026-05-07T18:01:00.000Z',
    acknowledgedAt: '2026-05-07T18:02:00.000Z',
    source: 'history' as const,
  },
]);

const notificationStoreMock = {
  notifications: notifications.asReadonly(),
  unreadCount: signal(3).asReadonly(),
  isHydrating: signal(false).asReadonly(),
  hydrationError: signal(null).asReadonly(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
  acknowledge: vi.fn(),
};
```

Add tests:

```typescript
it('maps lifecycle fields into notification panel items', () => {
  fixture.detectChanges();

  const app = fixture.componentInstance as any;
  expect(app.notificationPanelItems()).toEqual([
    expect.objectContaining({
      id: 'evt-001',
      readAt: '2026-05-07T18:01:00.000Z',
      acknowledgedAt: '2026-05-07T18:02:00.000Z',
    }),
  ]);
});

it('wires notification panel lifecycle outputs to the store', () => {
  fixture.detectChanges();
  const panel = fixture.debugElement.query(By.directive(NotificationPanelComponent)).componentInstance as NotificationPanelComponent;

  panel.markRead.emit('evt-001');
  panel.markAllRead.emit();
  panel.acknowledge.emit('evt-001');

  expect(notificationStoreMock.markRead).toHaveBeenCalledWith('evt-001');
  expect(notificationStoreMock.markAllRead).toHaveBeenCalled();
  expect(notificationStoreMock.acknowledge).toHaveBeenCalledWith('evt-001');
});

it('passes unread count to notification toggle', () => {
  fixture.detectChanges();
  const toggle = fixture.debugElement.query(By.directive(NotificationToggleComponent)).componentInstance as NotificationToggleComponent;

  expect(toggle.unreadCount).toBe(3);
});
```

- [ ] **Step 2: Run app tests and verify they fail**

Run:

```bash
CI=true npx nx test portal-web --skip-nx-cache --testFile=apps/portal-web/src/app/app.spec.ts
```

Expected: FAIL because `notificationPanelItems` is a getter and outputs/inputs are not wired.

- [ ] **Step 3: Update App component**

Update imports in `app.ts`:

```typescript
import { Component, inject, OnInit, DestroyRef, computed } from '@angular/core';
```

Replace the getter with:

```typescript
protected readonly notificationPanelItems = computed<NotificationPanelItem[]>(() =>
  this.notificationStore.notifications().map(item => ({
    id: item.id,
    title: item.title,
    summary: item.summary,
    severity: item.severity,
    category: item.category,
    actor: item.actor,
    timestamp: item.timestamp,
    userId: item.userId,
    readAt: item.readAt,
    acknowledgedAt: item.acknowledgedAt,
  }))
);

protected markNotificationRead(eventId: string): void {
  this.notificationStore.markRead(eventId);
}

protected markAllNotificationsRead(): void {
  this.notificationStore.markAllRead();
}

protected acknowledgeNotification(eventId: string): void {
  this.notificationStore.acknowledge(eventId);
}
```

Update `app.html`:

```html
<tai-notification-toggle
  [unreadCount]="notificationStore.unreadCount()"
  (toggled)="notificationPanelService.toggle()">
</tai-notification-toggle>
<tai-notification-panel
  [notifications]="notificationPanelItems()"
  [isLoading]="notificationStore.isHydrating()"
  [error]="notificationStore.hydrationError()"
  (retry)="notificationHistoryService.retry()"
  (markRead)="markNotificationRead($event)"
  (markAllRead)="markAllNotificationsRead()"
  (acknowledge)="acknowledgeNotification($event)">
</tai-notification-panel>
```

Add `NotificationPanelService` to app imports/injection:

```typescript
import { AppShellComponent, MenuItem, NotificationToggleComponent, NotificationPanelComponent, NotificationPanelItem, ToastComponent, NotificationPanelService } from '@tai/ui-design-system';

protected readonly notificationPanelService = inject(NotificationPanelService);
```

- [ ] **Step 4: Run app tests**

Run:

```bash
CI=true npx nx test portal-web --skip-nx-cache --testFile=apps/portal-web/src/app/app.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit app wiring**

```bash
git add apps/portal-web/src/app/app.ts apps/portal-web/src/app/app.html apps/portal-web/src/app/app.spec.ts
git commit -m "feat(notifications): wire lifecycle UI to store"
```

---

### Task 8: Lifecycle E2E

**Files:**
- Create: `apps/portal-web-e2e/src/notifications-lifecycle.spec.ts`

- [ ] **Step 1: Add e2e flow using existing authenticated privilege selectors**

Create `apps/portal-web-e2e/src/notifications-lifecycle.spec.ts`. Use the authenticated ACME admin storage state and privilege edit selectors from `apps/portal-web-e2e/src/privileges-audit.spec.ts`; do not use a fabricated login form flow. The test must follow this shape:

```typescript
import { expect, test } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { injectAuthSession } from './test-utils';

const authFile = path.join(__dirname, '../.auth/acme-admin.json');

test.describe('notification lifecycle', () => {
  test.use({ storageState: authFile });

  test('persists read and acknowledged state across refresh', async ({ page }) => {
    await injectAuthSession(page, 'acme-session.json');
    await page.goto('http://acme.localhost:4200/admin/privileges');
    await expect(page).toHaveURL(/.*\/admin\/privileges/);
    await expect(page.locator('tai-sidebar')).toBeVisible();

    const privilegeName = 'Portal.Users.Read';
    await page.getByPlaceholder(/search privileges/i).fill(privilegeName);
    await page.waitForResponse(res => res.url().includes('/api/privileges') && res.status() === 200);
    await page.waitForTimeout(500);
    await expect(page.getByTestId('table-loading')).toBeHidden();

    await page.locator('[data-testid^="action-menu-"]').first().click();
    const editMenuItem = page.getByRole('menuitem', { name: /edit/i });
    await expect(editMenuItem).toBeVisible({ timeout: 10000 });
    await editMenuItem.click({ force: true });

    await page.waitForURL(/.*\/admin\/privileges\/.*/, { timeout: 10000 });
    await expect(page.getByTestId('edit-form')).toBeVisible();

    const correlationId = uuidv4();
    await page.getByLabel(/description/i).fill(`Notification lifecycle update ${correlationId}`);
    await page.route('**/api/privileges/**', async (route) => {
      await route.continue({
        headers: {
          ...route.request().headers(),
          'X-Correlation-ID': correlationId,
          'X-Step-Up-Verified': 'true',
        },
      });
    });
    await page.getByRole('button', { name: /save changes/i }).click();
    await expect(page.getByTestId('read-only-view')).toBeVisible();

    const toggle = page.getByRole('button', { name: /toggle notifications/i });
    await expect(toggle).toBeVisible();
    await toggle.click();

    const panel = page.locator('tai-notification-panel .notification-panel');
    await expect(panel).toBeVisible();
    await expect(panel.getByText(/privilege/i)).toBeVisible();
    await expect(page.locator('.unread-badge')).toBeVisible();

    await panel.getByRole('button', { name: /mark notification as read/i }).first().click();
    await panel.getByRole('button', { name: /acknowledge critical notification/i }).first().click();
    await expect(panel.getByLabel(/acknowledged notification/i)).toBeVisible();

    await page.reload();
    await injectAuthSession(page, 'acme-session.json');
    await page.getByRole('button', { name: /toggle notifications/i }).click();
    await expect(panel).toBeVisible();

    await expect(panel.getByText(/privilege/i)).toBeVisible();
    await expect(panel.getByLabel(/read notification/i)).toBeVisible();
    await expect(panel.getByLabel(/acknowledged notification/i)).toBeVisible();
    await expect(panel.getByText(/privilege/i)).toHaveCount(1);
  });
});
```

If the privilege page changes, update selectors from existing privilege e2e files only. Do not introduce a test-only audit seeding endpoint.

- [ ] **Step 2: Run e2e and verify failure or selector issues**

Run:

```bash
CI=true npx nx e2e portal-web-e2e --skip-nx-cache --grep "notification lifecycle"
```

Expected before implementation completion: FAIL because lifecycle UI is absent. After Tasks 1-7, expected PASS if the existing privilege flow remains stable.

- [ ] **Step 3: Verify selectors against existing e2e patterns before changing them**

Open the closest existing files:

```bash
sed -n '1,240p' apps/portal-web-e2e/src/privileges-audit.spec.ts
sed -n '1,240p' apps/portal-web-e2e/src/user-privileges.spec.ts
```

Only change selectors if these files prove the current privilege flow uses different stable selectors. Keep the lifecycle assertions unchanged.

- [ ] **Step 4: Run e2e**

Run:

```bash
CI=true npx nx e2e portal-web-e2e --skip-nx-cache --grep "notification lifecycle"
```

Expected: PASS.

- [ ] **Step 5: Commit e2e**

```bash
git add apps/portal-web-e2e/src/notifications-lifecycle.spec.ts
git commit -m "test(notifications): cover lifecycle persistence e2e"
```

---

### Task 9: Full Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run portal-web unit tests**

```bash
CI=true npx nx test portal-web --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 2: Run design-system unit tests**

```bash
CI=true npx nx test design-system --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 3: Run portal-web build**

```bash
CI=true npx nx build portal-web --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 4: Run design-system Storybook build**

```bash
CI=true npx nx build-storybook design-system --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 5: Run e2e**

```bash
CI=true npx nx e2e portal-web-e2e --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 6: Inspect final diff**

```bash
git status --short
git diff --stat HEAD
```

Expected: only intended Sprint 3 files changed.

- [ ] **Step 7: Commit final verification notes if needed**

If verification required small fixes, commit them:

```bash
git add <changed-files>
git commit -m "fix(notifications): complete lifecycle verification"
```

If there are no changes after verification, do not create an empty commit.

---

## Plan Self-Review

- Spec coverage: lifecycle storage, OIDC subject scoping, encoded idempotency keys, 1,500-event retention, 10-scope LRU, store read/ack APIs, history scope setup, SignalR logging cleanup, toggle input refactor, panel lifecycle controls, app wiring, and e2e refresh persistence are covered.
- Completeness scan: each task names files, tests, implementation shape, commands, and expected results.
- Type consistency: lifecycle APIs are consistently named `setLifecycleScope`, `markRead`, `markAllRead`, `acknowledge`, `unreadCount`, `hasUnread`, and `criticalUnacknowledgedCount`.
