import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * NotificationToggleComponent
 *
 * Floating button at bottom-right corner with unread badge.
 * Similar to iOS app notification icons.
 *
 * Uses input/output pattern for maximum reusability:
 * - `unreadCount` input drives badge display
 * - `toggled` output emits when button is clicked
 * - Parent component wires to NotificationSignalStore
 */
@Component({
  selector: 'tai-notification-toggle',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-toggle.component.html',
  styleUrl: './notification-toggle.component.scss',
})
export class NotificationToggleComponent {
  @Input() unreadCount = 0;
  @Output() toggled = new EventEmitter<void>();

  toggle(): void {
    this.toggled.emit();
  }

  get displayCount(): string {
    return this.unreadCount > 9 ? '9+' : String(this.unreadCount);
  }

  get showBadge(): boolean {
    return this.unreadCount > 0;
  }
}