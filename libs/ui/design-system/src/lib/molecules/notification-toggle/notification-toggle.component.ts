import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationPanelConnectionState } from '../../organisms/notification-panel/notification-panel.types';
import { ButtonComponent } from '../../atoms/button/button.component';
import { IconComponent } from '../../atoms/icon/icon.component';

export type NotificationTogglePlacement = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

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
 * - `placement` selects one of the supported fixed viewport positions
 */
@Component({
  selector: 'tai-notification-toggle',
  standalone: true,
  imports: [CommonModule, ButtonComponent, IconComponent],
  templateUrl: './notification-toggle.component.html',
  host: {
    class: 'fixed z-50 block h-12 w-12',
    '[class.right-6]': "placement().endsWith('right')",
    '[class.left-6]': "placement().endsWith('left')",
    '[class.bottom-6]': "placement().startsWith('bottom')",
    '[class.top-6]': "placement().startsWith('top')",
  },
})
export class NotificationToggleComponent {
  unreadCount = input(0);
  isOpen = input(false);
  connectionState = input<NotificationPanelConnectionState>('connected');
  readonly placement = input<NotificationTogglePlacement>('bottom-right');
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
