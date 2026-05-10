import {
  mapAuditLogToNotification,
  NotificationMappingOptions,
} from './notification.mapper';
import { toPlainDisplayText, normalizeSearchText } from './notification-text.util';
import { isAuditLogDetails } from './audit-log-details.guard';
import { NotificationItem } from '../models/notification-item.model';
import { AuditLogDetails } from '../models/security-event.model';

describe('NotificationMapper', () => {
  const baseOptions: NotificationMappingOptions = {
    source: 'history',
    // expectedEventId and expectedTenantId are optional for RealTimeService
  };

  // Test 1: Maps privilege changes to critical privilege notifications
  describe('privilege change mapping', () => {
    it('should map privilege changes to critical severity and privilege category', () => {
      const auditLog: AuditLogDetails = {
        id: 'evt-001',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'PrivilegeChange',
        resourceId: 'privilege-1',
        correlationId: null,
        timestamp: '2026-05-01T10:00:00Z',
        ipAddress: '192.168.1.1',
        details: 'Added ManageUsers privilege',
        eventType: 'PrivilegeChange'
      };

      const result = mapAuditLogToNotification(auditLog, baseOptions);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('critical');
      expect(result!.category).toBe('privilege');
      expect(result!.eventType).toBe('PrivilegeChange');
    });

    it('should map privilege edit events to critical privilege notifications', () => {
      const auditLog: AuditLogDetails = {
        id: 'evt-002',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'EditPrivilege',
        resourceId: 'privilege-2',
        correlationId: null,
        timestamp: '2026-05-01T11:00:00Z',
        ipAddress: '192.168.1.1',
        details: 'Modified Admin privilege',
        eventType: 'PrivilegeEdit'
      };

      const result = mapAuditLogToNotification(auditLog, baseOptions);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('critical');
      expect(result!.category).toBe('privilege');
    });
  });

  // Test 2: Maps login anomalies to critical authentication notifications
  describe('login anomaly mapping', () => {
    it('should map login anomalies to critical severity and authentication category', () => {
      const auditLog: AuditLogDetails = {
        id: 'evt-003',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'LoginAnomaly',
        resourceId: 'session-1',
        correlationId: 'corr-1',
        timestamp: '2026-05-01T12:00:00Z',
        ipAddress: '10.0.0.1',
        details: 'Suspicious login from unknown location',
        eventType: 'LoginAnomaly'
      };

      const result = mapAuditLogToNotification(auditLog, baseOptions);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('critical');
      expect(result!.category).toBe('authentication');
      expect(result!.eventType).toBe('LoginAnomaly');
    });

    it('should map failed login attempts to authentication category', () => {
      const auditLog: AuditLogDetails = {
        id: 'evt-004',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'LoginFailed',
        resourceId: 'auth-1',
        correlationId: null,
        timestamp: '2026-05-01T13:00:00Z',
        ipAddress: '10.0.0.2',
        details: 'Invalid password attempt',
        eventType: 'LoginFailed'
      };

      const result = mapAuditLogToNotification(auditLog, baseOptions);

      expect(result).not.toBeNull();
      expect(result!.category).toBe('authentication');
    });
  });

  // Test 3: Maps warning actions to warning security notifications
  describe('warning action mapping', () => {
    it('should map warning actions to warning severity and security category', () => {
      const auditLog: AuditLogDetails = {
        id: 'evt-005',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'RateLimitExceeded',
        resourceId: 'api-1',
        correlationId: null,
        timestamp: '2026-05-01T14:00:00Z',
        ipAddress: '10.0.0.3',
        details: 'API rate limit exceeded',
        eventType: 'Warning'
      };

      const result = mapAuditLogToNotification(auditLog, baseOptions);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('warning');
      expect(result!.category).toBe('security');
    });

    it('should map suspicious activity to warning security notifications', () => {
      const auditLog: AuditLogDetails = {
        id: 'evt-006',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'SuspiciousActivity',
        resourceId: 'session-2',
        correlationId: 'corr-2',
        timestamp: '2026-05-01T15:00:00Z',
        ipAddress: '10.0.0.4',
        details: 'Unusual behavior detected',
        eventType: 'Warning'
      };

      const result = mapAuditLogToNotification(auditLog, baseOptions);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('warning');
      expect(result!.category).toBe('security');
    });
  });

  // Test 4: Maps unknown actions to stable info system notifications
  describe('unknown action mapping', () => {
    it('should map unknown actions to info severity and system category', () => {
      const auditLog: AuditLogDetails = {
        id: 'evt-007',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'SomeRandomAction',
        resourceId: 'resource-1',
        correlationId: null,
        timestamp: '2026-05-01T16:00:00Z',
        ipAddress: '10.0.0.5',
        details: 'Some action'
      };

      const result = mapAuditLogToNotification(auditLog, baseOptions);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('info');
      expect(result!.category).toBe('system');
    });
  });

  // Test 5: Uses action when eventType is missing
  describe('action fallback', () => {
    it('should use action when eventType is missing', () => {
      const auditLog: AuditLogDetails = {
        id: 'evt-008',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'PrivilegeChange',
        resourceId: 'privilege-3',
        correlationId: null,
        timestamp: '2026-05-01T17:00:00Z',
        ipAddress: '10.0.0.6',
        details: 'Privilege changed',
        eventType: null
      };

      const result = mapAuditLogToNotification(auditLog, baseOptions);

      expect(result).not.toBeNull();
      // Should fall back to action for classification
      expect(result!.severity).toBe('critical');
      expect(result!.category).toBe('privilege');
    });

    it('should use action when eventType is undefined', () => {
      const auditLog: AuditLogDetails = {
        id: 'evt-009',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'LoginAnomaly',
        resourceId: 'session-3',
        correlationId: null,
        timestamp: '2026-05-01T18:00:00Z',
        ipAddress: '10.0.0.7',
        details: 'Login anomaly detected'
        // eventType not provided
      };

      const result = mapAuditLogToNotification(auditLog, baseOptions);

      expect(result).not.toBeNull();
      expect(result!.category).toBe('authentication');
    });
  });

  // Test 6: Uses eventTypeHint as matching input without overriding higher risk priority
  describe('eventTypeHint handling', () => {
    it('should use eventTypeHint for matching without overriding critical priority', () => {
      const auditLog: AuditLogDetails = {
        id: 'evt-010',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'PrivilegeChange',
        resourceId: 'privilege-4',
        correlationId: null,
        timestamp: '2026-05-01T19:00:00Z',
        ipAddress: '10.0.0.8',
        details: 'Privilege change with warning hint',
        eventType: 'PrivilegeChange'
      };

      const options: NotificationMappingOptions = {
        ...baseOptions,
        eventTypeHint: 'Warning'
      };

      const result = mapAuditLogToNotification(auditLog, options);

      // PrivilegeChange should remain critical even with Warning hint
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('critical');
    });
  });

  // Test 7: Matches privilege case-insensitively
  describe('case-insensitive matching', () => {
    it('should match privilege keywords case-insensitively', () => {
      const auditLog: AuditLogDetails = {
        id: 'evt-011',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'PRIVILEGE_CHANGE',
        resourceId: 'privilege-5',
        correlationId: null,
        timestamp: '2026-05-01T20:00:00Z',
        ipAddress: '10.0.0.9',
        details: 'Privilege changed in uppercase'
      };

      const result = mapAuditLogToNotification(auditLog, baseOptions);

      expect(result).not.toBeNull();
      expect(result!.category).toBe('privilege');
      expect(result!.severity).toBe('critical');
    });

    it('should match mixed case privilege keywords', () => {
      const auditLog: AuditLogDetails = {
        id: 'evt-012',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'pRiViLeGeEdIt',
        resourceId: 'privilege-6',
        correlationId: null,
        timestamp: '2026-05-01T21:00:00Z',
        ipAddress: '10.0.1.1',
        details: 'Privilege edit in mixed case'
      };

      const result = mapAuditLogToNotification(auditLog, baseOptions);

      expect(result).not.toBeNull();
      expect(result!.category).toBe('privilege');
    });

    it('should match login anomaly case-insensitively', () => {
      const auditLog: AuditLogDetails = {
        id: 'evt-013',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'LOGIN_ANOMALY',
        resourceId: 'session-4',
        correlationId: null,
        timestamp: '2026-05-01T22:00:00Z',
        ipAddress: '10.0.1.2',
        details: 'Login anomaly in uppercase'
      };

      const result = mapAuditLogToNotification(auditLog, baseOptions);

      expect(result).not.toBeNull();
      expect(result!.category).toBe('authentication');
    });
  });

  // Test 8: Uses privilege priority for overlapping keywords
  describe('keyword priority', () => {
    it('should prioritize privilege over authentication for overlapping keywords', () => {
      const auditLog: AuditLogDetails = {
        id: 'evt-014',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'PrivilegeLoginAnomaly',
        resourceId: 'resource-2',
        correlationId: null,
        timestamp: '2026-05-02T10:00:00Z',
        ipAddress: '10.0.1.3',
        details: 'Overlapping keyword test'
      };

      const result = mapAuditLogToNotification(auditLog, baseOptions);

      expect(result).not.toBeNull();
      // Privilege should take priority
      expect(result!.category).toBe('privilege');
    });
  });

  // Test 9: Maps missing userId to System actor
  describe('missing userId handling', () => {
    it('should map missing userId to System actor', () => {
      const auditLog: AuditLogDetails = {
        id: 'evt-015',
        tenantId: 'tenant-1',
        userId: null,
        action: 'PrivilegeChange',
        resourceId: 'privilege-7',
        correlationId: null,
        timestamp: '2026-05-02T11:00:00Z',
        ipAddress: '10.0.1.4',
        details: 'System-initiated change'
      };

      const result = mapAuditLogToNotification(auditLog, baseOptions);

      expect(result).not.toBeNull();
      expect(result!.actor).toBe('System');
    });

    it('should map undefined userId to System actor', () => {
      const auditLog: AuditLogDetails = {
        id: 'evt-016',
        tenantId: 'tenant-1',
        userId: undefined,
        action: 'PrivilegeChange',
        resourceId: 'privilege-8',
        correlationId: null,
        timestamp: '2026-05-02T12:00:00Z',
        ipAddress: '10.0.1.5',
        details: 'System-initiated change'
      };

      const result = mapAuditLogToNotification(auditLog, baseOptions);

      expect(result).not.toBeNull();
      expect(result!.actor).toBe('System');
    });
  });

  // Test 10: Returns null for malformed input
  describe('malformed input handling', () => {
    it('should return null for null input', () => {
      const result = mapAuditLogToNotification(null as any, baseOptions);
      expect(result).toBeNull();
    });

    it('should return null for undefined input', () => {
      const result = mapAuditLogToNotification(undefined as any, baseOptions);
      expect(result).toBeNull();
    });

    it('should return null for non-object input', () => {
      const result = mapAuditLogToNotification('string' as any, baseOptions);
      expect(result).toBeNull();
    });
  });

  // Test 11: Returns null for empty required fields
  describe('empty required fields', () => {
    it('should return null when id is empty', () => {
      const auditLog: AuditLogDetails = {
        id: '',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'PrivilegeChange',
        resourceId: 'privilege-9',
        correlationId: null,
        timestamp: '2026-05-02T13:00:00Z',
        ipAddress: '10.0.1.6',
        details: 'Test'
      };

      const result = mapAuditLogToNotification(auditLog, baseOptions);
      expect(result).toBeNull();
    });

    it('should return null when tenantId is empty', () => {
      const auditLog: AuditLogDetails = {
        id: 'evt-017',
        tenantId: '',
        userId: 'user-1',
        action: 'PrivilegeChange',
        resourceId: 'privilege-10',
        correlationId: null,
        timestamp: '2026-05-02T14:00:00Z',
        ipAddress: '10.0.1.7',
        details: 'Test'
      };

      const result = mapAuditLogToNotification(auditLog, baseOptions);
      expect(result).toBeNull();
    });

    it('should return null when action is empty', () => {
      const auditLog: AuditLogDetails = {
        id: 'evt-018',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: '',
        resourceId: 'privilege-11',
        correlationId: null,
        timestamp: '2026-05-02T15:00:00Z',
        ipAddress: '10.0.1.8',
        details: 'Test'
      };

      const result = mapAuditLogToNotification(auditLog, baseOptions);
      expect(result).toBeNull();
    });
  });

  // Test 12: Returns null when expected event ID does not match
  describe('event ID validation', () => {
    it('should return null when expectedEventId does not match', () => {
      const auditLog: AuditLogDetails = {
        id: 'evt-019',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'PrivilegeChange',
        resourceId: 'privilege-12',
        correlationId: null,
        timestamp: '2026-05-02T16:00:00Z',
        ipAddress: '10.0.1.9',
        details: 'Test'
      };

      const options: NotificationMappingOptions = {
        ...baseOptions,
        expectedEventId: 'different-event-id'
      };

      const result = mapAuditLogToNotification(auditLog, options);
      expect(result).toBeNull();
    });

    it('should return notification when eventId matches expectedEventId', () => {
      const auditLog: AuditLogDetails = {
        id: 'evt-020',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'PrivilegeChange',
        resourceId: 'privilege-13',
        correlationId: null,
        timestamp: '2026-05-02T17:00:00Z',
        ipAddress: '10.0.2.1',
        details: 'Test'
      };

      const options: NotificationMappingOptions = {
        ...baseOptions,
        expectedEventId: 'evt-020'
      };

      const result = mapAuditLogToNotification(auditLog, options);
      expect(result).not.toBeNull();
    });
  });

  // Test 13: Returns null when expected tenant ID does not match
  describe('tenant ID validation', () => {
    it('should return null when expectedTenantId does not match', () => {
      const auditLog: AuditLogDetails = {
        id: 'evt-021',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'PrivilegeChange',
        resourceId: 'privilege-14',
        correlationId: null,
        timestamp: '2026-05-02T18:00:00Z',
        ipAddress: '10.0.2.2',
        details: 'Test'
      };

      const options: NotificationMappingOptions = {
        ...baseOptions,
        expectedTenantId: 'different-tenant'
      };

      const result = mapAuditLogToNotification(auditLog, options);
      expect(result).toBeNull();
    });

    it('should return notification when tenantId matches expectedTenantId', () => {
      const auditLog: AuditLogDetails = {
        id: 'evt-022',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'PrivilegeChange',
        resourceId: 'privilege-15',
        correlationId: null,
        timestamp: '2026-05-02T19:00:00Z',
        ipAddress: '10.0.2.3',
        details: 'Test'
      };

      const options: NotificationMappingOptions = {
        ...baseOptions,
        expectedTenantId: 'tenant-1'
      };

      const result = mapAuditLogToNotification(auditLog, options);
      expect(result).not.toBeNull();
    });
  });

  // Test 14: Preserves ISO timestamps
  describe('timestamp preservation', () => {
    it('should preserve ISO 8601 timestamps', () => {
      const auditLog: AuditLogDetails = {
        id: 'evt-023',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'PrivilegeChange',
        resourceId: 'privilege-16',
        correlationId: null,
        timestamp: '2026-05-03T10:30:00Z',
        ipAddress: '10.0.2.4',
        details: 'Test'
      };

      const result = mapAuditLogToNotification(auditLog, baseOptions);

      expect(result).not.toBeNull();
      expect(result!.timestamp).toBe('2026-05-03T10:30:00Z');
    });

    it('should preserve timestamps with timezone offset', () => {
      const auditLog: AuditLogDetails = {
        id: 'evt-024',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'PrivilegeChange',
        resourceId: 'privilege-17',
        correlationId: null,
        timestamp: '2026-05-03T10:30:00+05:00',
        ipAddress: '10.0.2.5',
        details: 'Test'
      };

      const result = mapAuditLogToNotification(auditLog, baseOptions);

      expect(result).not.toBeNull();
      expect(result!.timestamp).toBe('2026-05-03T10:30:00+05:00');
    });
  });

  // Test 15: Falls back to current time for invalid timestamps
  describe('invalid timestamp fallback', () => {
    it('should fall back to current time for invalid timestamp', () => {
      const auditLog: AuditLogDetails = {
        id: 'evt-025',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'PrivilegeChange',
        resourceId: 'privilege-18',
        correlationId: null,
        timestamp: 'invalid-timestamp',
        ipAddress: '10.0.2.6',
        details: 'Test'
      };

      const beforeTime = new Date().toISOString();
      const result = mapAuditLogToNotification(auditLog, baseOptions);
      const afterTime = new Date().toISOString();

      expect(result).not.toBeNull();
      // Should have a valid timestamp (within a reasonable range)
      expect(result!.timestamp).toBeDefined();
      expect(new Date(result!.timestamp).getTime()).toBeGreaterThanOrEqual(new Date(beforeTime).getTime() - 1000);
      expect(new Date(result!.timestamp).getTime()).toBeLessThanOrEqual(new Date(afterTime).getTime() + 1000);
    });

    it('should fall back to current time for empty timestamp', () => {
      const auditLog: AuditLogDetails = {
        id: 'evt-026',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'PrivilegeChange',
        resourceId: 'privilege-19',
        correlationId: null,
        timestamp: '',
        ipAddress: '10.0.2.7',
        details: 'Test'
      };

      const beforeTime = new Date().toISOString();
      const result = mapAuditLogToNotification(auditLog, baseOptions);
      const afterTime = new Date().toISOString();

      expect(result).not.toBeNull();
      expect(new Date(result!.timestamp).getTime()).toBeGreaterThanOrEqual(new Date(beforeTime).getTime() - 1000);
    });
  });

  // Test 16: Sets source from mapping options
  describe('source mapping', () => {
    it('should set source from mapping options - history', () => {
      const auditLog: AuditLogDetails = {
        id: 'evt-027',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'PrivilegeChange',
        resourceId: 'privilege-20',
        correlationId: null,
        timestamp: '2026-05-03T11:00:00Z',
        ipAddress: '10.0.2.8',
        details: 'Test'
      };

      const result = mapAuditLogToNotification(auditLog, baseOptions);

      expect(result).not.toBeNull();
      expect(result!.source).toBe('history');
    });

    it('should set source from mapping options - signalr', () => {
      const auditLog: AuditLogDetails = {
        id: 'evt-028',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'PrivilegeChange',
        resourceId: 'privilege-21',
        correlationId: null,
        timestamp: '2026-05-03T12:00:00Z',
        ipAddress: '10.0.2.9',
        details: 'Test'
      };

      const options: NotificationMappingOptions = {
        ...baseOptions,
        source: 'signalr'
      };

      const result = mapAuditLogToNotification(auditLog, options);

      expect(result).not.toBeNull();
      expect(result!.source).toBe('signalr');
    });
  });

  // Test 17: Normalizes display text with deterministic fallback
  describe('display text normalization', () => {
    it('should generate deterministic title and summary', () => {
      const auditLog: AuditLogDetails = {
        id: 'evt-029',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'PrivilegeChange',
        resourceId: 'privilege-22',
        correlationId: null,
        timestamp: '2026-05-03T13:00:00Z',
        ipAddress: '10.0.3.1',
        details: 'Added ManageUsers privilege'
      };

      const result = mapAuditLogToNotification(auditLog, baseOptions);

      expect(result).not.toBeNull();
      expect(result!.title).toBeDefined();
      expect(result!.summary).toBeDefined();
      expect(typeof result!.title).toBe('string');
      expect(typeof result!.summary).toBe('string');
      expect(result!.title.length).toBeGreaterThan(0);
    });

    it('should generate consistent title for same input', () => {
      const auditLog: AuditLogDetails = {
        id: 'evt-030',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'PrivilegeChange',
        resourceId: 'privilege-23',
        correlationId: null,
        timestamp: '2026-05-03T14:00:00Z',
        ipAddress: '10.0.3.2',
        details: 'Test privilege change'
      };

      const result1 = mapAuditLogToNotification(auditLog, baseOptions);
      const result2 = mapAuditLogToNotification(auditLog, baseOptions);

      expect(result1!.title).toBe(result2!.title);
      expect(result1!.summary).toBe(result2!.summary);
    });
  });

  // Test 18: Normalizes search text consistently
  describe('search text normalization', () => {
    it('should normalize search text to lowercase', () => {
      const input = 'SOME TEXT With MIXED Case';
      const result = normalizeSearchText(input);
      expect(result).toBe('some text with mixed case');
    });

    it('should trim whitespace from search text', () => {
      const input = '  spaces around  ';
      const result = normalizeSearchText(input);
      expect(result).toBe('spaces around');
    });

    it('should handle empty strings', () => {
      const input = '';
      const result = normalizeSearchText(input);
      expect(result).toBe('');
    });
  });

  // Test 19: Validates AuditLogDetails shape before mapping
  describe('AuditLogDetails validation', () => {
    it('should validate correct AuditLogDetails shape', () => {
      const validAuditLog: AuditLogDetails = {
        id: 'evt-031',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'PrivilegeChange',
        resourceId: 'privilege-24',
        correlationId: null,
        timestamp: '2026-05-03T15:00:00Z',
        ipAddress: '10.0.3.3',
        details: 'Test'
      };

      expect(isAuditLogDetails(validAuditLog)).toBe(true);
    });

    it('should reject invalid AuditLogDetails shape', () => {
      const invalidAuditLog = {
        id: 'evt-032',
        // missing tenantId
        userId: 'user-1',
        action: 'PrivilegeChange',
        resourceId: 'privilege-25'
        // missing required fields
      };

      expect(isAuditLogDetails(invalidAuditLog)).toBe(false);
    });

    it('should reject objects missing id', () => {
      const invalidAuditLog = {
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'PrivilegeChange',
        resourceId: 'privilege-26',
        timestamp: '2026-05-03T16:00:00Z'
      };

      expect(isAuditLogDetails(invalidAuditLog)).toBe(false);
    });
  });

  // Test 20: Token-based classification (token/segment matching)
  describe('token-based classification', () => {
    const baseAudit: AuditLogDetails = {
      id: 'evt-token-test',
      tenantId: 'tenant-1',
      userId: 'user-1',
      action: 'TestAction',
      resourceId: 'resource-1',
      correlationId: null,
      timestamp: '2026-05-04T10:00:00Z',
      ipAddress: '10.0.0.1',
      details: 'Test details'
    };

    it('matches warning token across PascalCase, hyphen, and whitespace', () => {
      for (const action of ['SecurityWarning', 'security-warning', 'security warning']) {
        const notification = mapAuditLogToNotification({
          ...baseAudit,
          id: `evt-${action}`,
          action,
          eventType: null,
          details: null,
        }, { source: 'history', expectedEventId: `evt-${action}`, expectedTenantId: 'tenant-1' });

        expect(notification?.severity).toBe('warning');
        expect(notification?.category).toBe('security');
      }
    });

    it('does not match warning inside unrelated larger words', () => {
      const notification = mapAuditLogToNotification({
        ...baseAudit,
        id: 'evt-forewarning',
        action: 'ForewarningReportExported',
        eventType: null,
        details: null,
      }, { source: 'history', expectedEventId: 'evt-forewarning', expectedTenantId: 'tenant-1' });

      expect(notification?.severity).toBe('info');
      expect(notification?.category).toBe('system');
    });
  });

  // Additional test: toPlainDisplayText utility
  describe('toPlainDisplayText utility', () => {
    it('should convert camelCase to plain text', () => {
      const input = 'camelCaseText';
      const result = toPlainDisplayText(input);
      expect(result).toBe('camel case text');
    });

    it('should handle PascalCase', () => {
      const input = 'PascalCaseText';
      const result = toPlainDisplayText(input);
      expect(result).toBe('pascal case text');
    });

    it('should handle snake_case', () => {
      const input = 'snake_case_text';
      const result = toPlainDisplayText(input);
      expect(result).toBe('snake case text');
    });

    it('should handle kebab-case', () => {
      const input = 'kebab-case-text';
      const result = toPlainDisplayText(input);
      expect(result).toBe('kebab case text');
    });

    it('should handle empty string', () => {
      const input = '';
      const result = toPlainDisplayText(input);
      expect(result).toBe('');
    });

    it('should handle already plain text', () => {
      const input = 'plain text';
      const result = toPlainDisplayText(input);
      expect(result).toBe('plain text');
    });
  });

  // Additional test: maps all required fields
  describe('full mapping coverage', () => {
    it('should map all required NotificationItem fields', () => {
      const auditLog: AuditLogDetails = {
        id: 'evt-033',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'PrivilegeChange',
        resourceId: 'privilege-27',
        correlationId: 'corr-3',
        timestamp: '2026-05-03T17:00:00Z',
        ipAddress: '10.0.3.4',
        details: 'Full mapping test',
        eventType: 'PrivilegeChange'
      };

      const result = mapAuditLogToNotification(auditLog, baseOptions);

      expect(result).not.toBeNull();
      expect(result!.id).toBeDefined();
      expect(result!.tenantId).toBeDefined();
      expect(result!.eventType).toBeDefined();
      expect(result!.severity).toBeDefined();
      expect(result!.category).toBeDefined();
      expect(result!.title).toBeDefined();
      expect(result!.summary).toBeDefined();
      expect(result!.timestamp).toBeDefined();
      expect(result!.actor).toBeDefined();
      expect(result!.userId).toBeDefined();
      expect(result!.ipAddress).toBeDefined();
      expect(result!.resourceId).toBeDefined();
      expect(result!.correlationId).toBeDefined();
      expect(result!.readAt).toBeNull();
      expect(result!.acknowledgedAt).toBeNull();
      expect(result!.source).toBeDefined();
    });
  });
});
