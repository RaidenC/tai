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
        'evt-003': { readAt: 'May 7, 2026', acknowledgedAt: null },
        '__proto__': { readAt: '2026-05-07T18:00:00.000Z', acknowledgedAt: null },
        constructor: { readAt: '2026-05-07T18:00:00.000Z', acknowledgedAt: null },
      })
    );

    const result = service.read({ tenantId: 'tenant-1', userId: 'user-sub-1' });
    expect(result).toEqual({
      'evt-001': { readAt: '2026-05-07T18:00:00.000Z', acknowledgedAt: null },
    });
    expect((Object.prototype as Record<string, unknown>)['polluted']).toBeUndefined();
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

  it('keeps exactly 10 scope keys and moves existing read scopes to most recently used', () => {
    for (let i = 0; i < 10; i += 1) {
      service.write(
        { tenantId: `tenant-${i}`, userId: `user-${i}` },
        { [`evt-${i}`]: { readAt: '2026-05-07T18:00:00.000Z', acknowledgedAt: null } },
        [`evt-${i}`]
      );
    }

    service.read({ tenantId: 'tenant-3', userId: 'user-3' });
    service.write(
      { tenantId: 'tenant-new', userId: 'user-new' },
      { 'evt-new': { readAt: '2026-05-07T18:00:00.000Z', acknowledgedAt: null } },
      ['evt-new']
    );

    const index = JSON.parse(localStorage.getItem('tai.portal.notifications.lifecycle.scopes.v1') ?? '[]');
    expect(index).toHaveLength(10);
    expect(index[0]).toBe('tai.portal.notifications.lifecycle.v1:tenant-new:user-new');
    expect(index).toContain('tai.portal.notifications.lifecycle.v1:tenant-3:user-3');
    expect(index).not.toContain('tai.portal.notifications.lifecycle.v1:tenant-0:user-0');
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