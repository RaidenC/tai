import { TestBed } from '@angular/core/testing';
import { RealTimeService } from './real-time.service';
import { AuthService } from './auth.service';
import { HttpClient, HttpHandler } from '@angular/common/http';
import { HubConnectionState } from '@microsoft/signalr';
import { BehaviorSubject, of, firstValueFrom } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditLogDetails } from './models/security-event.model';

describe('RealTimeService', () => {
  let service: RealTimeService;
  let authServiceMock: Partial<AuthService>;
  let isAuthenticatedSubject: BehaviorSubject<boolean>;
  let httpClientMock: {
    get: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    isAuthenticatedSubject = new BehaviorSubject<boolean>(false);

    // Mock AuthService
    authServiceMock = {
      isAuthenticated$: isAuthenticatedSubject.asObservable(),
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

    TestBed.configureTestingModule({
      providers: [
        RealTimeService,
        { provide: AuthService, useValue: authServiceMock },
        { provide: HttpClient, useValue: httpClientMock },
        HttpHandler,
      ],
    });

    service = TestBed.inject(RealTimeService);
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
});