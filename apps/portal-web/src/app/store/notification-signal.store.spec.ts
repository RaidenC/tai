import { TestBed } from '@angular/core/testing';
import { NotificationSignalStore } from './notification-signal.store';
import { NotificationItem } from '../models/notification-item.model';

describe('NotificationSignalStore', () => {
  let store: NotificationSignalStore;

  const mockNotification: NotificationItem = {
    id: 'evt-001',
    tenantId: 'tenant-1',
    eventType: 'PrivilegeModified',
    severity: 'critical',
    category: 'privilege',
    title: 'Privilege modified',
    summary: 'Privilege Trade Approver was modified',
    timestamp: '2026-05-03T10:00:00.000Z',
    actor: 'admin@tai.com',
    userId: 'admin@tai.com',
    ipAddress: '10.0.0.12',
    resourceId: 'priv-123',
    correlationId: null,
    readAt: null,
    acknowledgedAt: null,
    source: 'signalr',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [NotificationSignalStore]
    });
    store = TestBed.inject(NotificationSignalStore);
  });

  it('should be created', () => {
    expect(store).toBeTruthy();
  });

  describe('addNotification (newest first)', () => {
    it('should add notification to buffer', () => {
      store.addNotification(mockNotification);
      expect(store.notifications().length).toBe(1);
      expect(store.notifications()[0].id).toBe('evt-001');
    });

    it('should add newest notifications at the beginning', () => {
      store.addNotification({ ...mockNotification, id: 'evt-001' });
      store.addNotification({ ...mockNotification, id: 'evt-002' });
      store.addNotification({ ...mockNotification, id: 'evt-003' });

      const notifications = store.notifications();
      expect(notifications[0].id).toBe('evt-003');
      expect(notifications[1].id).toBe('evt-002');
      expect(notifications[2].id).toBe('evt-001');
    });

    it('should prevent duplicate notifications (idempotency)', () => {
      store.addNotification(mockNotification);
      store.addNotification(mockNotification);
      expect(store.notifications().length).toBe(1);
    });
  });

  describe('eventBuffer as deprecated alias', () => {
    it('should provide eventBuffer as read-only alias for notifications', () => {
      store.addNotification(mockNotification);
      expect(store.eventBuffer().length).toBe(1);
      expect(store.eventBuffer()[0].id).toBe('evt-001');
    });
  });

  describe('deduping by ID', () => {
    it('should skip duplicate events with same ID', () => {
      store.addNotification(mockNotification);
      store.addNotification({ ...mockNotification, id: 'evt-001' });
      expect(store.notifications().length).toBe(1);
    });
  });

  describe('FIFO eviction after 50 items', () => {
    it('should limit buffer to 50 notifications', () => {
      for (let i = 0; i < 60; i++) {
        store.addNotification({ ...mockNotification, id: `evt-${i}` });
      }
      expect(store.notifications().length).toBe(50);
      expect(store.notifications()[0].id).toBe('evt-59');
      expect(store.notifications()[49].id).toBe('evt-10');
    });
  });

  describe('Re-adding after idempotency cache eviction', () => {
    it('should re-add notification after idempotency cache clears', () => {
      // Add 1000 unique notifications to trigger cache eviction
      for (let i = 0; i < 1000; i++) {
        store.addNotification({ ...mockNotification, id: `evt-${i}` });
      }
      // The cache should have been cleared, keeping only last 50
      expect(store.notifications().length).toBe(50);

      // Adding the first event again should work (cache was cleared)
      // Since we add newest at beginning and limit to 50, evt-001 will replace the oldest
      store.addNotification({ ...mockNotification, id: 'evt-001' });
      // Still 50 because we slice to MAX_BUFFER_SIZE
      expect(store.notifications().length).toBe(50);
      // But evt-001 is now at the beginning (newest)
      expect(store.notifications()[0].id).toBe('evt-001');
    });
  });

  describe('filter by severity', () => {
    it('should filter notifications by severity', () => {
      store.addNotification({ ...mockNotification, id: 'evt-1', severity: 'critical' });
      store.addNotification({ ...mockNotification, id: 'evt-2', severity: 'warning' });
      store.addNotification({ ...mockNotification, id: 'evt-3', severity: 'info' });

      store.setSeverityFilter('critical');
      expect(store.filteredNotifications().length).toBe(1);
      expect(store.filteredNotifications()[0].id).toBe('evt-1');

      store.setSeverityFilter('warning');
      expect(store.filteredNotifications().length).toBe(1);
      expect(store.filteredNotifications()[0].id).toBe('evt-2');
    });

    it('should return all when severity filter is null', () => {
      store.addNotification({ ...mockNotification, id: 'evt-1', severity: 'critical' });
      store.addNotification({ ...mockNotification, id: 'evt-2', severity: 'warning' });

      store.setSeverityFilter(null);
      expect(store.filteredNotifications().length).toBe(2);
    });
  });

  describe('search metadata normalization', () => {
    it('should filter notifications by search text', () => {
      store.addNotification({ ...mockNotification, id: 'evt-1', title: 'Privilege modified', summary: 'Trade Approver changed', eventType: 'PrivilegeChange' });
      store.addNotification({ ...mockNotification, id: 'evt-2', title: 'Login anomaly', summary: 'Failed login attempt', eventType: 'LoginAnomaly' });

      store.setSearchText('privilege');
      expect(store.filteredNotifications().length).toBe(1);
      expect(store.filteredNotifications()[0].id).toBe('evt-1');

      store.setSearchText('login');
      expect(store.filteredNotifications().length).toBe(1);
      expect(store.filteredNotifications()[0].id).toBe('evt-2');
    });

    it('should be case-insensitive', () => {
      store.addNotification({ ...mockNotification, id: 'evt-1', title: 'Privilege modified' });

      store.setSearchText('PRIVILEGE');
      expect(store.filteredNotifications().length).toBe(1);
    });

    it('should combine severity filter and search text', () => {
      store.addNotification({ ...mockNotification, id: 'evt-1', severity: 'critical', title: 'Critical login change' });
      store.addNotification({ ...mockNotification, id: 'evt-2', severity: 'info', title: 'Info system update' });

      store.setSeverityFilter('critical');
      store.setSearchText('login');
      expect(store.filteredNotifications().length).toBe(1);
      expect(store.filteredNotifications()[0].id).toBe('evt-1');
    });
  });

  describe('removeNotification', () => {
    it('should remove notification from buffer', () => {
      store.addNotification(mockNotification);
      store.removeNotification('evt-001');
      expect(store.notifications().length).toBe(0);
    });

    it('should handle removing non-existent notification', () => {
      store.addNotification(mockNotification);
      store.removeNotification('non-existent');
      expect(store.notifications().length).toBe(1);
    });
  });

  describe('clearNotifications', () => {
    it('should clear all notifications', () => {
      store.addNotification(mockNotification);
      store.clearNotifications();
      expect(store.notifications().length).toBe(0);
    });
  });

  describe('clearForAuthBoundaryChange', () => {
    it('should clear all notifications', () => {
      store.addNotification(mockNotification);
      store.clearForAuthBoundaryChange();
      expect(store.notifications().length).toBe(0);
    });
  });

  describe('backward compatibility (addEvent, removeEvent, clearBuffer)', () => {
    it('should add event via addEvent method', () => {
      store.addEvent({
        id: 'evt-001',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'LOGIN',
        resourceId: 'resource-1',
        correlationId: null,
        timestamp: '2026-03-31T10:00:00Z',
        ipAddress: '192.168.1.1',
        details: 'Test event'
      });
      expect(store.notifications().length).toBe(1);
      expect(store.notifications()[0].id).toBe('evt-001');
    });

    it('should remove event via removeEvent method', () => {
      store.addEvent({
        id: 'evt-001',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'LOGIN',
        resourceId: 'resource-1',
        correlationId: null,
        timestamp: '2026-03-31T10:00:00Z',
        ipAddress: '192.168.1.1',
        details: 'Test event'
      });
      store.removeEvent('evt-001');
      expect(store.notifications().length).toBe(0);
    });

    it('should clear buffer via clearBuffer method', () => {
      store.addEvent({
        id: 'evt-001',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'LOGIN',
        resourceId: 'resource-1',
        correlationId: null,
        timestamp: '2026-03-31T10:00:00Z',
        ipAddress: '192.168.1.1',
        details: 'Test event'
      });
      store.clearBuffer();
      expect(store.notifications().length).toBe(0);
    });
  });

  describe('latestNotification', () => {
    it('should return null when buffer is empty', () => {
      expect(store.latestNotification()).toBeNull();
    });

    it('should return the most recent notification', () => {
      store.addNotification({ ...mockNotification, id: 'evt-001' });
      store.addNotification({ ...mockNotification, id: 'evt-002' });
      store.addNotification({ ...mockNotification, id: 'evt-003' });
      expect(store.latestNotification()?.id).toBe('evt-003');
    });
  });
});
