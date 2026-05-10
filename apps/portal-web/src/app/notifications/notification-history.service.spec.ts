import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService, User } from '../auth.service';
import { AuditLogDetails } from '../models/security-event.model';
import { NotificationSignalStore } from '../store/notification-signal.store';
import { NotificationHistoryService } from './notification-history.service';

describe('NotificationHistoryService', () => {
  let user$: BehaviorSubject<User | null>;
  let http: { get: ReturnType<typeof vi.fn> };
  let store: NotificationSignalStore;
  // Service is injected to trigger constructor which sets up subscriptions
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let _service: NotificationHistoryService;

  // Spies on store methods for verification
  let setLifecycleScopeSpy: ReturnType<typeof vi.spyOn>;
  let markReadSpy: ReturnType<typeof vi.spyOn>;
  let markAllReadSpy: ReturnType<typeof vi.spyOn>;
  let acknowledgeSpy: ReturnType<typeof vi.spyOn>;
  let addNotificationsSpy: ReturnType<typeof vi.spyOn>;
  let clearForAuthBoundaryChangeSpy: ReturnType<typeof vi.spyOn>;

  const adminUser: User = {
    id: 'user-1',
    name: 'Admin',
    email: 'admin@tai.com',
    tenantId: 'tenant-1',
    roles: ['Admin'],
    privileges: [],
  };

  const auditRow: AuditLogDetails = {
    id: 'evt-1',
    tenantId: 'tenant-1',
    userId: 'admin@tai.com',
    action: 'PrivilegeModified',
    resourceId: 'priv-1',
    correlationId: null,
    timestamp: '2026-05-06T10:00:00.000Z',
    ipAddress: '10.0.0.1',
    details: 'Privilege changed',
  };

  beforeEach(() => {
    user$ = new BehaviorSubject<User | null>(null);
    http = { get: vi.fn(() => of([auditRow])) };

    TestBed.configureTestingModule({
      providers: [
        NotificationHistoryService,
        NotificationSignalStore,
        { provide: AuthService, useValue: { user$: user$.asObservable(), checkAuth: vi.fn(() => of({ isAuthenticated: true })) } },
        { provide: HttpClient, useValue: http },
      ],
    });

    store = TestBed.inject(NotificationSignalStore);

    // Set up spies on store methods
    setLifecycleScopeSpy = vi.spyOn(store, 'setLifecycleScope');
    markReadSpy = vi.spyOn(store, 'markRead');
    markAllReadSpy = vi.spyOn(store, 'markAllRead');
    acknowledgeSpy = vi.spyOn(store, 'acknowledge');
    addNotificationsSpy = vi.spyOn(store, 'addNotifications');
    // Mock clearForAuthBoundaryChange to avoid internal setLifecycleScope(null) call
    // This allows tests to verify the service uses clearForAuthBoundaryChange as the canonical method
    // rather than directly calling setLifecycleScope(null)
    clearForAuthBoundaryChangeSpy = vi.spyOn(store, 'clearForAuthBoundaryChange').mockImplementation(() => {
      // Clear notifications, idempotency cache, and hydration state
      // but do NOT call setLifecycleScope(null) - that's handled by the service's handleAuthBoundary
      store.clearNotifications();
      // Directly set hydration state signals without going through setLifecycleScope
      (store as unknown as { _isHydrating: { set: (v: boolean) => void } })._isHydrating.set(false);
      (store as unknown as { _hydrationError: { set: (v: string | null) => void } })._hydrationError.set(null);
      (store as unknown as { _hasHydrated: { set: (v: boolean) => void } })._hasHydrated.set(false);
    });
  });

  // Helper to instantiate service after test setup
  function instantiateService(): NotificationHistoryService {
    return (_service = TestBed.inject(NotificationHistoryService));
  }

  it('hydrates recent audit rows after user tenant is available', () => {
    instantiateService();
    user$.next(adminUser);

    expect(http.get).toHaveBeenCalledWith('/api/AuditLogs/recent?limit=50', { withCredentials: true });
    expect(store.notifications()).toHaveLength(1);
    expect(store.notifications()[0]).toMatchObject({ id: 'evt-1', source: 'history', severity: 'critical' });
    expect(store.hasHydrated()).toBe(true);
    expect(store.isHydrating()).toBe(false);
  });

  it('fails closed when tenant id is null', () => {
    instantiateService();
    user$.next({ ...adminUser, tenantId: null });

    expect(http.get).not.toHaveBeenCalled();
    expect(store.hydrationError()).toBe('Unable to verify notification tenant.');
    expect(store.isHydrating()).toBe(false);
  });

  it('keeps existing SignalR notifications when empty history returns', () => {
    store.addNotification({ ...storeNotification(), id: 'signalr-1', source: 'signalr' });
    http.get.mockReturnValue(of([]));
    instantiateService();

    user$.next(adminUser);

    expect(store.notifications().map(n => n.id)).toEqual(['signalr-1']);
    expect(store.isEmpty()).toBe(false);
  });

  it('adds valid rows and skips malformed rows in partial mapping failure', () => {
    http.get.mockReturnValue(of([auditRow, { ...auditRow, id: '', action: '' }]));
    instantiateService();

    user$.next(adminUser);

    expect(store.notifications()).toHaveLength(1);
    expect(store.hydrationError()).toBeNull();
  });

  it('sets hydration error when all rows fail mapping', () => {
    http.get.mockReturnValue(of([{ ...auditRow, id: '', action: '' }]));
    instantiateService();

    user$.next(adminUser);

    expect(store.notifications()).toHaveLength(0);
    expect(store.hydrationError()).toBe('Unable to load recent notifications');
    expect(store.hasHydrated()).toBe(false);
  });

  it('maps 403, 404, 429, and network failures to panel errors', () => {
    instantiateService();
    const cases = [
      [{ status: 403 }, 'You do not have access to recent notifications.'],
      [{ status: 404 }, 'Unable to load recent notifications'],
      [{ status: 429 }, 'Recent notifications are temporarily rate limited.'],
      [{ status: 0 }, 'Unable to load recent notifications'],
    ] as const;

    for (const [error, message] of cases) {
      store.clearForAuthBoundaryChange();
      http.get.mockReturnValueOnce(throwError(() => error));
      user$.next({ ...adminUser, id: `user-${message}` });
      expect(store.hydrationError()).toBe(message);
    }
  });

  it('cancels stale tenant response on tenant switch', () => {
    const firstResponse = new Subject<AuditLogDetails[]>();
    http.get.mockReturnValueOnce(firstResponse.asObservable());
    http.get.mockReturnValueOnce(of([{ ...auditRow, id: 'evt-tenant-2', tenantId: 'tenant-2' }]));
    instantiateService();

    user$.next(adminUser);
    user$.next({ ...adminUser, tenantId: 'tenant-2' });
    firstResponse.next([auditRow]);
    firstResponse.complete();

    expect(store.notifications().map(n => n.id)).toEqual(['evt-tenant-2']);
  });

  it('sets lifecycle scope from tenantId and OIDC subject before hydration rows are added', () => {
    http.get.mockReturnValue(of([auditRow]));
    instantiateService();

    user$.next({ ...adminUser, id: 'user-sub-1', tenantId: 'tenant-1', email: 'changed@tai.com' });

    expect(setLifecycleScopeSpy).toHaveBeenCalledWith({ tenantId: 'tenant-1', userId: 'user-sub-1' });
    expect(setLifecycleScopeSpy.mock.invocationCallOrder[0])
      .toBeLessThan(addNotificationsSpy.mock.invocationCallOrder[0]);
  });

  it('clears auth boundary state through the store on logout', () => {
    http.get.mockReturnValue(of([]));
    instantiateService();

    user$.next({ ...adminUser, id: 'user-sub-1', tenantId: 'tenant-1' });
    user$.next(null);

    expect(clearForAuthBoundaryChangeSpy).toHaveBeenCalled();
    expect(setLifecycleScopeSpy).not.toHaveBeenCalledWith(null);
  });

  it('switches tenant scope and rehydrates when switching back to the original tenant', () => {
    http.get.mockReturnValue(of([]));
    instantiateService();

    user$.next({ ...adminUser, id: 'user-sub-1', tenantId: 'tenant-1' });
    user$.next({ ...adminUser, id: 'user-sub-1', tenantId: 'tenant-2' });
    user$.next({ ...adminUser, id: 'user-sub-1', tenantId: 'tenant-1' });

    expect(setLifecycleScopeSpy).toHaveBeenCalledWith({ tenantId: 'tenant-1', userId: 'user-sub-1' });
    expect(setLifecycleScopeSpy).toHaveBeenCalledWith({ tenantId: 'tenant-2', userId: 'user-sub-1' });
    expect(http.get).toHaveBeenCalledTimes(3);
  });
});

function storeNotification() {
  return {
    id: 'evt-store',
    tenantId: 'tenant-1',
    eventType: 'PrivilegeModified',
    severity: 'critical' as const,
    category: 'privilege' as const,
    title: 'Privilege modified',
    summary: 'Privilege changed',
    timestamp: '2026-05-06T10:00:00.000Z',
    actor: 'admin@tai.com',
    userId: 'admin@tai.com',
    ipAddress: null,
    resourceId: 'priv-1',
    correlationId: null,
    readAt: null,
    acknowledgedAt: null,
    source: 'signalr' as const,
  };
}
