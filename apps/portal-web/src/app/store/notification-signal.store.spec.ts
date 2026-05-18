import { TestBed } from '@angular/core/testing';
import { getNotificationIdempotencyKey, NotificationSignalStore } from './notification-signal.store';
import { NotificationItem } from '../models/notification-item.model';
import { NotificationLifecycleStorageService } from '../notifications/notification-lifecycle-storage.service';

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
      providers: [NotificationSignalStore, NotificationLifecycleStorageService]
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

  describe('tenant-scoped idempotency', () => {
    it('builds tenant-scoped idempotency keys in exact format', () => {
      expect(getNotificationIdempotencyKey({ tenantId: 'tenant-1', id: 'evt-1' }))
        .toBe('tenant-1:evt-1');
    });

    it('adds notification batches newest first and dedupes inside the batch', () => {
      store.addNotifications([
        { ...mockNotification, id: 'evt-1', timestamp: '2026-05-03T10:00:00.000Z', source: 'history' },
        { ...mockNotification, id: 'evt-2', timestamp: '2026-05-03T10:02:00.000Z', source: 'history' },
        { ...mockNotification, id: 'evt-1', timestamp: '2026-05-03T10:01:00.000Z', source: 'history' },
      ]);

      expect(store.notifications().map(n => n.id)).toEqual(['evt-2', 'evt-1']);
    });

    it('dedupes history and SignalR events by tenant-scoped key', () => {
      store.addNotification({ ...mockNotification, id: 'evt-1', tenantId: 'tenant-1', source: 'history' });
      store.addNotification({ ...mockNotification, id: 'evt-1', tenantId: 'tenant-1', source: 'signalr' });
      store.addNotification({ ...mockNotification, id: 'evt-1', tenantId: 'tenant-2', source: 'history' });

      expect(store.notifications()).toHaveLength(2);
      expect(store.notifications().map(n => `${n.tenantId}:${n.id}`)).toContain('tenant-1:evt-1');
      expect(store.notifications().map(n => `${n.tenantId}:${n.id}`)).toContain('tenant-2:evt-1');
    });

    it('evicts idempotency keys FIFO and allows evicted keys to be re-added', () => {
      store.addNotification({ ...mockNotification, id: 'evt-0000', tenantId: 'tenant-1' });

      for (let i = 1; i <= 1000; i++) {
        store.addNotification({ ...mockNotification, id: `evt-${i.toString().padStart(4, '0')}`, tenantId: 'tenant-1' });
      }

      store.addNotification({ ...mockNotification, id: 'evt-0000', tenantId: 'tenant-1', summary: 're-added after FIFO eviction' });
      store.addNotification({ ...mockNotification, id: 'evt-1000', tenantId: 'tenant-1', summary: 'should remain deduped' });

      expect(store.notifications()[0].summary).toBe('re-added after FIFO eviction');
      expect(store.notifications().filter(n => n.id === 'evt-1000')).toHaveLength(1);
    });

    it('tracks hydration state and empty state', () => {
      expect(store.isHydrating()).toBe(false);
      expect(store.hasHydrated()).toBe(false);
      expect(store.isEmpty()).toBe(false);

      store.setHydrating(true);
      expect(store.isHydrating()).toBe(true);
      expect(store.isEmpty()).toBe(false);

      store.setHydrating(false);
      store.markHydrated();
      expect(store.hasHydrated()).toBe(true);
      expect(store.isEmpty()).toBe(true);

      store.setHydrationError('Unable to load recent notifications');
      expect(store.hydrationError()).toBe('Unable to load recent notifications');
      expect(store.isEmpty()).toBe(false);
    });

    it('clearForAuthBoundaryChange clears notifications, idempotency, and hydration state', () => {
      store.addNotification(mockNotification);
      store.setHydrationError('Unable to load recent notifications');
      store.markHydrated();

      store.clearForAuthBoundaryChange();
      store.addNotification({ ...mockNotification, summary: 'allowed after clear' });

      expect(store.notifications()).toHaveLength(1);
      expect(store.notifications()[0].summary).toBe('allowed after clear');
      expect(store.hydrationError()).toBeNull();
      expect(store.hasHydrated()).toBe(false);
      expect(store.isHydrating()).toBe(false);
    });
  });

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
      // This test runs 1501 addNotification + markRead iterations.
      // Sprint 3 added NgZone.run() to markRead, which triggers change detection
      // for each iteration, making the test slower than the default 5000ms timeout.
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
    }, 15000);

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
});
