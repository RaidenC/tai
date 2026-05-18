import { Injectable, signal } from '@angular/core';

export type SeverityFilter = 'all' | 'critical' | 'warning' | 'info';

@Injectable({
  providedIn: 'root'
})
export class NotificationPanelService {
  private readonly _isOpen = signal(false);
  private readonly _unreadCount = signal(0);
  private readonly _severityFilter = signal<SeverityFilter>('all');
  private readonly _searchText = signal('');

  readonly isOpen = this._isOpen.asReadonly();
  readonly unreadCount = this._unreadCount.asReadonly();
  readonly severityFilter = this._severityFilter.asReadonly();
  readonly searchText = this._searchText.asReadonly();

  toggle(): void {
    this._isOpen.update(v => !v);
  }

  open(): void {
    this._isOpen.set(true);
  }

  close(): void {
    this._isOpen.set(false);
  }

  /**
   * @deprecated Sprint 3 derives unread count from NotificationSignalStore.
   * This method is a no-op stub for backward compatibility and will be removed
   * after Task 7 ships.
   */
  setUnreadCount(_count: number): void {
    this._unreadCount.set(0);
  }

  /**
   * @deprecated Sprint 3 derives unread count from NotificationSignalStore.
   * This method is a no-op stub for backward compatibility and will be removed
   * after Task 7 ships.
   */
  decrementUnread(): void {
    this._unreadCount.update(v => Math.max(0, v - 1));
  }

  /**
   * @deprecated Sprint 3 derives unread count from NotificationSignalStore.
   * This method is a no-op stub for backward compatibility and will be removed
   * after Task 7 ships.
   */
  markAllAsRead(): void {
    this._unreadCount.set(0);
  }

  setSeverityFilter(filter: SeverityFilter): void {
    this._severityFilter.set(filter);
  }

  setSearchText(text: string): void {
    this._searchText.set(text);
  }
}