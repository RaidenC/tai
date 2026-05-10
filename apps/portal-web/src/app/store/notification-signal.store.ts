import { Injectable, signal, computed, inject } from '@angular/core';
import { AuditLogDetails } from '../models/security-event.model';
import { NotificationItem, NotificationSeverity } from '../models/notification-item.model';
import { mapAuditLogToNotification } from '../notifications/notification.mapper';
import { normalizeSearchText } from '../notifications/notification-text.util';
import {
  encodeNotificationKeySegment,
  NotificationLifecycleRecords,
  NotificationLifecycleScope,
  NotificationLifecycleStorageService,
} from '../notifications/notification-lifecycle-storage.service';

const MAX_BUFFER_SIZE = 50;
const MAX_IDEMPOTENCY_CACHE = 1000;
const MAX_LIFECYCLE_EVENT_QUEUE = 1500;

export { encodeNotificationKeySegment };

/**
 * Generate a tenant-scoped idempotency key for a notification.
 * Format: `${encodedTenantId}:${encodedId}`
 * Uses encodeURIComponent to avoid colon collisions in tenant IDs or event IDs containing colons.
 */
export function getNotificationIdempotencyKey(notification: Pick<NotificationItem, 'tenantId' | 'id'>): string {
  return `${encodeNotificationKeySegment(notification.tenantId)}:${encodeNotificationKeySegment(notification.id)}`;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationSignalStore {
  private readonly _notifications = signal<NotificationItem[]>([]);
  private readonly _severityFilter = signal<NotificationSeverity | null>(null);
  private readonly _searchText = signal<string>('');
  private readonly seenNotificationKeys = new Set<string>();
  private readonly seenNotificationKeyQueue: string[] = [];
  private readonly _isHydrating = signal(false);
  private readonly _hydrationError = signal<string | null>(null);
  private readonly _hasHydrated = signal(false);

  // Lifecycle state for read/unread tracking
  private readonly lifecycleStorage = inject(NotificationLifecycleStorageService);
  private readonly _lifecycleScope = signal<NotificationLifecycleScope | null>(null);
  private lifecycleRecords: NotificationLifecycleRecords = {};
  private readonly lifecycleEventIdQueue: string[] = [];

  // Primary accessors
  readonly notifications = this._notifications.asReadonly();

  // Deprecated: Use notifications instead. Typed as AuditLogDetails[] for backward compatibility with existing consumers.
  // TODO: Remove type assertion after migrating consumers (app.html, real-time.service) to use NotificationItem
  readonly eventBuffer = (() => this._notifications()) as unknown as () => AuditLogDetails[];

  readonly severityFilter = this._severityFilter.asReadonly();
  readonly searchText = this._searchText.asReadonly();

  // Hydration state signals
  readonly isHydrating = this._isHydrating.asReadonly();
  readonly hydrationError = this._hydrationError.asReadonly();
  readonly hasHydrated = this._hasHydrated.asReadonly();
  readonly isEmpty = computed(() =>
    !this._isHydrating() &&
    this._hasHydrated() &&
    this._hydrationError() === null &&
    this._notifications().length === 0
  );

  // Lifecycle computed signals
  readonly unreadCount = computed(() => this._notifications().filter(item => item.readAt === null).length);
  readonly hasUnread = computed(() => this.unreadCount() > 0);
  readonly criticalUnacknowledgedCount = computed(() =>
    this._notifications().filter(item => item.severity === 'critical' && item.acknowledgedAt === null).length
  );

  // Latest notification (newest first, so first in array)
  readonly latestNotification = computed(() => {
    const buffer = this._notifications();
    return buffer.length > 0 ? buffer[0] : null;
  });

  // Backward-compatible: Typed as AuditLogDetails for existing consumers
  // TODO: Remove type assertion after migrating consumers to NotificationItem
  readonly latestEvent = computed(() => {
    const buffer = this._notifications();
    return buffer.length > 0 ? buffer[0] as unknown as AuditLogDetails : null;
  });

  // Filtered notifications based on severity and search
  readonly filteredNotifications = computed(() => {
    let result = this._notifications();
    const severity = this._severityFilter();
    const search = this._searchText();

    if (severity) {
      result = result.filter(n => n.severity === severity);
    }

    if (search) {
      const normalizedSearch = normalizeSearchText(search);
      result = result.filter(n =>
        normalizeSearchText(n.title).includes(normalizedSearch) ||
        normalizeSearchText(n.summary).includes(normalizedSearch) ||
        normalizeSearchText(n.eventType).includes(normalizedSearch) ||
        normalizeSearchText(n.actor).includes(normalizedSearch) ||
        normalizeSearchText(n.userId).includes(normalizedSearch)
      );
    }

    return result;
  });

  /**
   * Add a notification directly to the store.
   * Newest notifications are added at the beginning (index 0).
   */
  addNotification(notification: NotificationItem): void {
    this.addNotifications([notification]);
  }

  /**
   * Add multiple notifications to the store.
   * Newest notifications are added at the beginning (index 0).
   * Deduplication is performed inside the batch and against existing notifications.
   * Lifecycle state (read/unread, acknowledged) is overlaid from persisted records.
   */
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

  /**
   * Set hydration state to indicate loading.
   */
  setHydrating(isHydrating: boolean): void {
    this._isHydrating.set(isHydrating);
  }

  /**
   * Set hydration error message.
   */
  setHydrationError(message: string | null): void {
    this._hydrationError.set(message);
  }

  /**
   * Mark hydration as complete.
   */
  markHydrated(): void {
    this._hasHydrated.set(true);
  }

  /**
   * Set severity filter for filtered notifications.
   * Pass null to show all severities.
   */
  setSeverityFilter(severity: NotificationSeverity | null): void {
    this._severityFilter.set(severity);
  }

  /**
   * Set search text for filtered notifications.
   * Searches in title, summary, eventType, actor, and userId.
   */
  setSearchText(text: string): void {
    this._searchText.set(text);
  }

  // ========== Lifecycle Methods ==========

  /**
   * Set the lifecycle scope for read/unread state persistence.
   * Reads persisted lifecycle records from storage for the given tenant/user.
   */
  setLifecycleScope(scope: NotificationLifecycleScope | null): void {
    this._lifecycleScope.set(scope);
    this.lifecycleRecords = scope ? this.lifecycleStorage.read(scope) : {};
    this.lifecycleEventIdQueue.length = 0;

    if (scope) {
      this.lifecycleEventIdQueue.push(...Object.keys(this.lifecycleRecords).slice(-MAX_LIFECYCLE_EVENT_QUEUE));
    }
  }

  /**
   * Mark a notification as read.
   * Updates both in-memory state and persisted lifecycle storage.
   * Does nothing if the notification is already read or doesn't exist.
   */
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

  /**
   * Mark all retained notifications as read.
   * Updates both in-memory state and persisted lifecycle storage.
   */
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

  /**
   * Acknowledge a critical notification.
   * Also marks it as read if not already read.
   * Does nothing for non-critical notifications or if already acknowledged.
   */
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

  /**
   * Remove a notification by ID.
   */
  removeNotification(eventId: string): void {
    this._notifications.update((buffer: NotificationItem[]) =>
      buffer.filter((n: NotificationItem) => n.id !== eventId)
    );
  }

  /**
   * Clear all notifications.
   */
  clearNotifications(): void {
    this._notifications.set([]);
    this.seenNotificationKeys.clear();
    this.seenNotificationKeyQueue.length = 0;
  }

  /**
   * Clear for authentication boundary change.
   * Clears notifications, idempotency cache, lifecycle scope, and hydration state.
   * Does not delete persisted lifecycle records from localStorage.
   */
  clearForAuthBoundaryChange(): void {
    this.clearNotifications();
    this.setLifecycleScope(null);
    this._isHydrating.set(false);
    this._hydrationError.set(null);
    this._hasHydrated.set(false);
  }

  // ========== Backward Compatibility Methods ==========

  /**
   * Add an AuditLogDetails event to the store.
   * Converts to NotificationItem using the mapper.
   * @deprecated Use addNotification with NotificationItem instead
   */
  addEvent(event: AuditLogDetails): void {
    const key = getNotificationIdempotencyKey({ tenantId: event.tenantId, id: event.id });
    if (this.seenNotificationKeys.has(key)) {
      return;
    }

    // Map AuditLogDetails to NotificationItem
    const notification = mapAuditLogToNotification(event, { source: 'signalr' });
    if (!notification) {
      return;
    }

    this.addNotification(notification);
  }

  /**
   * Remove an event by ID.
   * @deprecated Use removeNotification instead
   */
  removeEvent(eventId: string): void {
    this.removeNotification(eventId);
  }

  /**
   * Clear the event buffer.
   * @deprecated Use clearNotifications instead
   */
  clearBuffer(): void {
    this.clearNotifications();
  }

  // ========== Private Methods ==========

  private trackSeenKey(key: string): void {
    this.seenNotificationKeys.add(key);
    this.seenNotificationKeyQueue.push(key);

    while (this.seenNotificationKeyQueue.length > MAX_IDEMPOTENCY_CACHE) {
      const evicted = this.seenNotificationKeyQueue.shift();
      if (evicted) {
        this.seenNotificationKeys.delete(evicted);
      }
    }
  }

  // ========== Lifecycle Private Methods ==========

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
}
