import { TestBed } from '@angular/core/testing';
import { RealTimeService } from './real-time.service';
import { AuthService } from './auth.service';
import { HttpClient, HttpHandler } from '@angular/common/http';
import { HubConnectionState } from '@microsoft/signalr';
import { BehaviorSubject, of, firstValueFrom, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditLogDetails } from './models/security-event.model';
import { NotificationSignalStore } from './store/notification-signal.store';
import { NotificationPanelService } from '@tai/ui-design-system';

describe('RealTimeService', () => {
  let service: RealTimeService;
  let authServiceMock: Partial<AuthService>;
  let isAuthenticatedSubject: BehaviorSubject<boolean>;
  let httpClientMock: {
    get: ReturnType<typeof vi.fn>;
  };
  let store: NotificationSignalStore;
  let mockPanelService: Partial<NotificationPanelService>;

  beforeEach(() => {
    isAuthenticatedSubject = new BehaviorSubject<boolean>(false);

    const userSubject = new BehaviorSubject<any>({
      id: 'user-1',
      name: 'Test User',
      email: 'test@tai.com',
      tenantId: 'tenant-1',
      roles: ['Admin'],
      privileges: [],
    });

    // Mock AuthService
    authServiceMock = {
      isAuthenticated$: isAuthenticatedSubject.asObservable(),
      user$: userSubject.asObservable(),
      checkAuth: vi.fn(() => of({ isAuthenticated: true })),
    };

    // Mock AuditLogDetails
    const mockAuditLogDetails: AuditLogDetails = {
      id: 'event-123',
      tenantId: 'tenant-1',
      userId: 'user-1',
      action: 'LOGIN',
      resourceId: 'resource-1',
      correlationId: null,
      timestamp: '2026-03-31T10:00:00Z',
      ipAddress: '192.168.1.1',
      details: 'Login successful',
    };

    // Mock HttpClient
    httpClientMock = {
      get: vi.fn().mockReturnValue(of(mockAuditLogDetails)),
    };

    // Mock NotificationPanelService to verify it's not called
    mockPanelService = {
      setUnreadCount: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        RealTimeService,
        NotificationSignalStore,
        { provide: AuthService, useValue: authServiceMock },
        { provide: HttpClient, useValue: httpClientMock },
        { provide: NotificationPanelService, useValue: mockPanelService },
        HttpHandler,
      ],
    });

    service = TestBed.inject(RealTimeService);
    store = TestBed.inject(NotificationSignalStore);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have connectionStatus$ observable', () => {
    expect(service.connectionStatus$).toBeTruthy();
  });

  it('should have securityEvents$ observable', () => {
    expect(service.securityEvents$).toBeTruthy();
  });

  it('should emit initial disconnected state', async () => {
    const status = await firstValueFrom(service.connectionStatus$);
    expect(status).toBe(HubConnectionState.Disconnected);
  });

  it('should have securityEvents$ that starts with null', async () => {
    const details = await firstValueFrom(service.securityEvents$);
    expect(details).toBeNull();
  });

  it('should fetch audit log details through the relative API route', () => {
    (service as any).fetchAuditLogDetails('event-123').subscribe();

    expect(httpClientMock.get).toHaveBeenCalledWith('/api/AuditLogs/event-123', {
      withCredentials: true,
    });
  });

  it('should add fetched security events to the notification store', async () => {
    await (service as any).handleSecurityEvent({
      eventType: 'PrivilegeChange',
      payload: { eventId: 'event-123' },
    });

    expect(store.eventBuffer().length).toBeGreaterThan(0);
  });

  describe('Model Types', () => {
    it('should correctly type SecurityEventPayload', () => {
      const payload = {
        EventId: 'event-123',
        Timestamp: '2026-03-31T10:00:00Z',
        EventType: 'LoginSuccess',
      };

      expect(payload.EventId).toBe('event-123');
      expect(payload.Timestamp).toBe('2026-03-31T10:00:00Z');
    });

    it('should correctly type AuditLogDetails', () => {
      const details: AuditLogDetails = {
        id: 'event-123',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'LOGIN',
        resourceId: 'resource-1',
        correlationId: null,
        timestamp: '2026-03-31T10:00:00Z',
        ipAddress: '192.168.1.1',
        details: 'Login successful',
      };

      expect(details.id).toBe('event-123');
      expect(details.action).toBe('LOGIN');
      expect(details.tenantId).toBe('tenant-1');
    });

    it('should handle missing optional fields in AuditLogDetails', () => {
      const details: AuditLogDetails = {
        id: 'event-123',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'LOGIN',
        resourceId: 'resource-1',
        correlationId: null,
        timestamp: '2026-03-31T10:00:00Z',
        ipAddress: null,
        details: null,
      };

      expect(details.ipAddress).toBeNull();
      expect(details.details).toBeNull();
      expect(details.correlationId).toBeNull();
    });
  });

  describe('Security Sanitization', () => {
    it('adds SignalR notification without updating NotificationPanelService unread count', async () => {
      httpClientMock.get.mockReturnValue(of({
        id: 'event-123',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'PrivilegeModified',
        resourceId: 'resource-1',
        correlationId: null,
        timestamp: '2026-03-31T10:00:00Z',
        ipAddress: '192.168.1.1',
        details: 'Privilege modified',
      } as AuditLogDetails));

      await (service as any).handleSecurityEvent({ eventId: 'event-123', eventType: 'PrivilegeModified' });

      expect(store.eventBuffer().length).toBeGreaterThan(0);
      expect(mockPanelService.setUnreadCount).not.toHaveBeenCalled();
    });

    it('does not log security event payloads, audit details, notifications, event IDs, or error objects', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      httpClientMock.get.mockReturnValue(throwError(() => new Error('contains-event-123')));

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

      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });
});
