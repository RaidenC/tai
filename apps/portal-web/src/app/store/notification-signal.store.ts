import { Injectable, signal, computed } from '@angular/core';
import { AuditLogDetails } from '../models/security-event.model';
import { NotificationItem, NotificationSeverity } from '../models/notification-item.model';
import { mapAuditLogToNotification } from '../notifications/notification.mapper';
import { normalizeSearchText } from '../notifications/notification-text.util';

const MAX_BUFFER_SIZE = 50;
const MAX_IDEMPOTENCY_CACHE = 1000;

@Injectable({
  providedIn: 'root'
})
export class NotificationSignalStore {
  private readonly _notifications = signal<NotificationItem[]>([]);
  private readonly _severityFilter = signal<NotificationSeverity | null>(null);
  private readonly _searchText = signal<string>('');
  private readonly seenEventIds = new Set<string>();

  // Primary accessors
  readonly notifications = this._notifications.asReadonly();

  // Deprecated: Use notifications instead. Typed as AuditLogDetails[] for backward compatibility with existing consumers.
  // TODO: Remove type assertion after migrating consumers (app.html, real-time.service) to use NotificationItem
  readonly eventBuffer = (() => this._notifications()) as unknown as () => AuditLogDetails[];

  readonly severityFilter = this._severityFilter.asReadonly();
  readonly searchText = this._searchText.asReadonly();

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
    if (this.seenEventIds.has(notification.id)) {
      console.log(`NotificationSignalStore: Duplicate notification ${notification.id} skipped`);
      return;
    }

    this.seenEventIds.add(notification.id);

    this._notifications.update((buffer: NotificationItem[]) => {
      // Add new notification at the beginning (newest first)
      const newBuffer: NotificationItem[] = [notification, ...buffer];
      if (newBuffer.length > MAX_BUFFER_SIZE) {
        // Keep only the most recent MAX_BUFFER_SIZE items
        return newBuffer.slice(0, MAX_BUFFER_SIZE);
      }
      return newBuffer;
    });

    this.handleIdempotencyCacheOverflow();
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
    this.seenEventIds.clear();
  }

  /**
   * Clear for authentication boundary change.
   * Alias for clearNotifications for semantic clarity.
   */
  clearForAuthBoundaryChange(): void {
    this.clearNotifications();
  }

  // ========== Backward Compatibility Methods ==========

  /**
   * Add an AuditLogDetails event to the store.
   * Converts to NotificationItem using the mapper.
   * @deprecated Use addNotification with NotificationItem instead
   */
  addEvent(event: AuditLogDetails): void {
    if (this.seenEventIds.has(event.id)) {
      console.log(`NotificationSignalStore: Duplicate event ${event.id} skipped`);
      return;
    }

    // Map AuditLogDetails to NotificationItem
    const notification = mapAuditLogToNotification(event, { source: 'signalr' });
    if (!notification) {
      console.warn(`NotificationSignalStore: Failed to map event ${event.id}`);
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

  private handleIdempotencyCacheOverflow(): void {
    if (this.seenEventIds.size > MAX_IDEMPOTENCY_CACHE) {
      const buffer = this._notifications();
      this.seenEventIds.clear();
      buffer.forEach((n: NotificationItem) => this.seenEventIds.add(n.id));
    }
  }
}
