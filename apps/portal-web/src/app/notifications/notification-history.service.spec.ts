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
    _service = TestBed.inject(NotificationHistoryService);
  });

  it('hydrates recent audit rows after user tenant is available', () => {
    user$.next(adminUser);

    expect(http.get).toHaveBeenCalledWith('/api/AuditLogs/recent?limit=50', { withCredentials: true });
    expect(store.notifications()).toHaveLength(1);
    expect(store.notifications()[0]).toMatchObject({ id: 'evt-1', source: 'history', severity: 'critical' });
    expect(store.hasHydrated()).toBe(true);
    expect(store.isHydrating()).toBe(false);
  });

  it('fails closed when tenant id is null', () => {
    user$.next({ ...adminUser, tenantId: null });

    expect(http.get).not.toHaveBeenCalled();
    expect(store.hydrationError()).toBe('Unable to verify notification tenant.');
    expect(store.isHydrating()).toBe(false);
  });

  it('keeps existing SignalR notifications when empty history returns', () => {
    store.addNotification({ ...storeNotification(), id: 'signalr-1', source: 'signalr' });
    http.get.mockReturnValue(of([]));

    user$.next(adminUser);

    expect(store.notifications().map(n => n.id)).toEqual(['signalr-1']);
    expect(store.isEmpty()).toBe(false);
  });

  it('adds valid rows and skips malformed rows in partial mapping failure', () => {
    http.get.mockReturnValue(of([auditRow, { ...auditRow, id: '', action: '' }]));

    user$.next(adminUser);

    expect(store.notifications()).toHaveLength(1);
    expect(store.hydrationError()).toBeNull();
  });

  it('sets hydration error when all rows fail mapping', () => {
    http.get.mockReturnValue(of([{ ...auditRow, id: '', action: '' }]));

    user$.next(adminUser);

    expect(store.notifications()).toHaveLength(0);
    expect(store.hydrationError()).toBe('Unable to load recent notifications');
    expect(store.hasHydrated()).toBe(false);
  });

  it('maps 403, 404, 429, and network failures to panel errors', () => {
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

    user$.next(adminUser);
    user$.next({ ...adminUser, tenantId: 'tenant-2' });
    firstResponse.next([auditRow]);
    firstResponse.complete();

    expect(store.notifications().map(n => n.id)).toEqual(['evt-tenant-2']);
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
