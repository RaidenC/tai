import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificationPanelService, SeverityFilter } from './notification-panel.service';
import { AuditLogDetails } from './notification-panel.types';

@Component({
  selector: 'tai-notification-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notification-panel.component.html',
  styleUrl: './notification-panel.component.scss',
})
export class NotificationPanelComponent {
  private readonly panelService = inject(NotificationPanelService);

  @Input() events: AuditLogDetails[] = [];

  readonly isOpen = this.panelService.isOpen;
  readonly severityFilter = this.panelService.severityFilter;
  readonly searchText = this.panelService.searchText;

  // Filtered events based on severity and search
  readonly filteredEvents = (): AuditLogDetails[] => {
    const allEvents = this.events || [];
    const filter = this.severityFilter()();
    const search = this.searchText()().toLowerCase();

    return allEvents
      .filter(event => {
        const matchesSeverity = filter === 'all' || this.getEventSeverity(event.action) === filter;
        const matchesSearch = !search ||
          event.action.toLowerCase().includes(search) ||
          (event.details && event.details.toLowerCase().includes(search));
        return matchesSeverity && matchesSearch;
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
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

  getEventSeverity(action: string): string {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('critical') || actionLower.includes('anomaly')) {
      return 'critical';
    }
    if (actionLower.includes('warning')) {
      return 'warning';
    }
    return 'info';
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