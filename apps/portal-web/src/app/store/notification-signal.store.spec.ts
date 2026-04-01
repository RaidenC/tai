import { TestBed } from '@angular/core/testing';
import { NotificationSignalStore } from './notification-signal.store';
import { AuditLogDetails } from '../models/security-event.model';

describe('NotificationSignalStore', () => {
  let store: NotificationSignalStore;

  const mockEvent: AuditLogDetails = {
    id: 'evt-001',
    tenantId: 'tenant-1',
    userId: 'user-1',
    action: 'LOGIN',
    resourceId: 'resource-1',
    correlationId: null,
    timestamp: '2026-03-31T10:00:00Z',
    ipAddress: '192.168.1.1',
    details: 'Test event'
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

  describe('addEvent', () => {
    it('should add event to buffer', () => {
      store.addEvent(mockEvent);
      expect(store.eventBuffer().length).toBe(1);
      expect(store.eventBuffer()[0].id).toBe('evt-001');
    });

    it('should prevent duplicate events (idempotency)', () => {
      store.addEvent(mockEvent);
      store.addEvent(mockEvent);
      expect(store.eventBuffer().length).toBe(1);
    });

    it('should limit buffer to 50 events', () => {
      for (let i = 0; i < 60; i++) {
        store.addEvent({ ...mockEvent, id: `evt-${i}` });
      }
      expect(store.eventBuffer().length).toBe(50);
      expect(store.eventBuffer()[0].id).toBe('evt-10');
    });
  });

  describe('removeEvent', () => {
    it('should remove event from buffer', () => {
      store.addEvent(mockEvent);
      store.removeEvent('evt-001');
      expect(store.eventBuffer().length).toBe(0);
    });
  });

  describe('clearBuffer', () => {
    it('should clear all events and idempotency cache', () => {
      store.addEvent(mockEvent);
      store.clearBuffer();
      expect(store.eventBuffer().length).toBe(0);
    });
  });
});