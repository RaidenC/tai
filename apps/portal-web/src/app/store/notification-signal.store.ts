import { Injectable, signal, computed } from '@angular/core';
import { AuditLogDetails } from '../models/security-event.model';
import { NotificationItem, NotificationSeverity } from '../models/notification-item.model';
import { mapAuditLogToNotification } from '../notifications/notification.mapper';
import { normalizeSearchText } from '../notifications/notification-text.util';

const MAX_BUFFER_SIZE = 50;
const MAX_IDEMPOTENCY_CACHE = 1000;

/**
 * Generate a tenant-scoped idempotency key for a notification.
 * Format: `${tenantId}:${id}`
 */
export function getNotificationIdempotencyKey(notification: Pick<NotificationItem, 'tenantId' | 'id'>): string {
  return `${notification.tenantId}:${notification.id}`;
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
   */
  addNotifications(notifications: NotificationItem[]): void {
    const uniqueNotifications: NotificationItem[] = [];

    for (const notification of notifications) {
      const key = getNotificationIdempotencyKey(notification);
      if (this.seenNotificationKeys.has(key)) {
        continue;
      }

      this.trackSeenKey(key);
      uniqueNotifications.push(notification);
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
   * Alias for clearNotifications for semantic clarity.
   */
  clearForAuthBoundaryChange(): void {
    this.clearNotifications();
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
}
