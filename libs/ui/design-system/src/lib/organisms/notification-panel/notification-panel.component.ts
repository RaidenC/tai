import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificationPanelService, SeverityFilter } from './notification-panel.service';
import { NotificationPanelItem, NotificationPanelConnectionState } from './notification-panel.types';

@Component({
  selector: 'tai-notification-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notification-panel.component.html',
  styleUrl: './notification-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationPanelComponent {
  private readonly panelService = inject(NotificationPanelService);

  @Input() notifications: NotificationPanelItem[] = [];
  @Input() isLoading = false;
  @Input() hasHydrated = false;
  @Input() error: string | null = null;
  @Input() connectionState: NotificationPanelConnectionState = 'connected';
  @Input() isRetryThrottled = false;
  @Input() recoveryNotice: string | null = null;
  @Output() retry = new EventEmitter<void>();
  @Output() markRead = new EventEmitter<string>();
  @Output() markAllRead = new EventEmitter<void>();
  @Output() acknowledge = new EventEmitter<string>();

  readonly isOpen = this.panelService.isOpen;
  readonly severityFilter = this.panelService.severityFilter;
  readonly searchText = this.panelService.searchText;

  onRetry(): void {
    if (this.isLoading || this.isRetryThrottled) {
      return;
    }
    this.retry.emit();
  }

  readonly hasUnread = (): boolean => this.notifications.some(notification => notification.readAt === null);

  onMarkRead(notification: NotificationPanelItem): void {
    if (notification.readAt) {
      return;
    }
    this.markRead.emit(notification.id);
  }

  onMarkAllRead(): void {
    if (!this.hasUnread()) {
      return;
    }
    this.markAllRead.emit();
  }

  onAcknowledge(notification: NotificationPanelItem): void {
    if (notification.severity !== 'critical' || notification.acknowledgedAt) {
      return;
    }
    this.acknowledge.emit(notification.id);
  }

  // Filtered notifications based on severity and search
  readonly filteredNotifications = (): NotificationPanelItem[] => {
    const allNotifications = this.notifications || [];
    const filter = this.severityFilter()();
    const search = this.searchText()().toLowerCase();

    return allNotifications
      .filter(notification => {
        const matchesSeverity = filter === 'all' || notification.severity === filter;
        const matchesSearch = !search ||
          notification.title.toLowerCase().includes(search) ||
          (notification.summary && notification.summary.toLowerCase().includes(search)) ||
          notification.actor.toLowerCase().includes(search);
        return matchesSeverity && matchesSearch;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  setSeverity(filter: SeverityFilter): void {
    this.panelService.setSeverityFilter(filter);
  }

  onSearchChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.panelService.setSearchText(target.value);
  }

  close(): void {
    this.panelService.close();
  }

  getSeverityClass(severity: string): string {
    switch (severity) {
      case 'critical': return 'severity-critical';
      case 'warning': return 'severity-warning';
      default: return 'severity-info';
    }
  }

  formatTime(timestamp: string): string {
    if (!timestamp) {
      return 'Unknown';
    }
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      return 'Unknown';
    }
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hr ago`;
    return date.toLocaleDateString();
  }
}
