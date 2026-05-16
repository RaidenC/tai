import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationPanelConnectionState } from '../../organisms/notification-panel/notification-panel.types';

/**
 * NotificationToggleComponent
 *
 * Floating button at bottom-right corner with unread badge.
 * Similar to iOS app notification icons.
 *
 * Uses signal inputs for reactive integration with NotificationSignalStore:
 * - `unreadCount` signal input drives badge display
 * - `toggled` output emits when button is clicked
 * - Parent component passes computed signal directly for automatic updates
 */
@Component({
  selector: 'tai-notification-toggle',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-toggle.component.html',
  styleUrl: './notification-toggle.component.scss',
})
export class NotificationToggleComponent {
  unreadCount = input(0);
  isOpen = input(false);
  connectionState = input<NotificationPanelConnectionState>('connected');
  toggled = output<void>();

  readonly displayCount = computed(() => {
    const count = this.unreadCount();
    return count > 9 ? '9+' : String(count);
  });

  readonly showBadge = computed(() => this.unreadCount() > 0);

  readonly accessibleLabel = computed(() => {
    switch (this.connectionState()) {
      case 'reconnecting':
        return 'Toggle notifications, updates reconnecting';
      case 'disconnected':
        return 'Toggle notifications, updates offline';
      default:
        return 'Toggle notifications';
    }
  });

  readonly showConnectionIndicator = computed(() => this.connectionState() !== 'connected');

  toggle(): void {
    this.toggled.emit();
  }
}