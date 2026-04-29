import { Injectable, signal, computed } from '@angular/core';

export type SeverityFilter = 'all' | 'critical' | 'warning' | 'info';

@Injectable({
  providedIn: 'root'
})
export class NotificationPanelService {
  private readonly _isOpen = signal(false);
  private readonly _unreadCount = signal(0);
  private readonly _severityFilter = signal<SeverityFilter>('all');
  private readonly _searchText = signal('');

  readonly isOpen = computed(() => this._isOpen);
  readonly unreadCount = computed(() => this._unreadCount);
  readonly severityFilter = computed(() => this._severityFilter);
  readonly searchText = computed(() => this._searchText);

  toggle(): void {
    this._isOpen.update(v => !v);
  }

  open(): void {
    this._isOpen.set(true);
  }

  close(): void {
    this._isOpen.set(false);
  }

  setUnreadCount(count: number): void {
    this._unreadCount.set(count);
  }

  decrementUnread(): void {
    this._unreadCount.update(v => Math.max(0, v - 1));
  }

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