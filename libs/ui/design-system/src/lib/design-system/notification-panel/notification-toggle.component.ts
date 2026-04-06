import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationPanelService } from './notification-panel.service';

/**
 * NotificationToggleComponent
 *
 * Floating button at bottom-right corner with unread badge.
 * Similar to iOS app notification icons.
 */
@Component({
  selector: 'tai-notification-toggle',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-toggle.component.html',
  styleUrl: './notification-toggle.component.scss',
})
export class NotificationToggleComponent {
  private readonly panelService = inject(NotificationPanelService);

  readonly unreadCount = this.panelService.unreadCount;

  toggle(): void {
    this.panelService.toggle();
  }

  get displayCount(): number {
    const count = this.unreadCount()();
    return count > 9 ? 9 : count;
  }

  get showBadge(): boolean {
    return this.unreadCount()() > 0;
  }
}