import { type Meta, type StoryObj, applicationConfig, moduleMetadata } from '@storybook/angular';
import { provideRouter } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NotificationPanelComponent } from './notification-panel.component';
import { NotificationPanelService } from './notification-panel.service';
import { AuditLogDetails } from './notification-panel.types';

const mockEvents: AuditLogDetails[] = [
  {
    id: '1',
    tenantId: 'tenant-1',
    userId: 'user-1',
    action: 'LoginAnomaly',
    resourceId: 'resource-1',
    correlationId: 'corr-1',
    timestamp: new Date().toISOString(),
    ipAddress: '192.168.1.1',
    details: 'Suspicious login detected from unknown location'
  },
  {
    id: '2',
    tenantId: 'tenant-1',
    userId: 'user-2',
    action: 'CriticalSecurityAlert',
    resourceId: 'resource-2',
    correlationId: 'corr-2',
    timestamp: new Date(Date.now() - 60000).toISOString(),
    ipAddress: '10.0.0.1',
    details: 'Multiple failed login attempts'
  },
  {
    id: '3',
    tenantId: 'tenant-1',
    userId: 'user-3',
    action: 'UserPermissionChanged',
    resourceId: 'resource-3',
    correlationId: null,
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    ipAddress: null,
    details: 'Admin permissions granted'
  },
  {
    id: '4',
    tenantId: 'tenant-1',
    userId: 'user-4',
    action: 'WarningRateLimit',
    resourceId: 'resource-4',
    correlationId: 'corr-4',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    ipAddress: '172.16.0.1',
    details: 'Rate limit approaching threshold'
  }
];

interface StoryPanelState {
  open?: boolean;
  severity?: 'all' | 'critical' | 'warning' | 'info';
  search?: string;
}

const withPanelState = ({ open = true, severity = 'all', search = '' }: StoryPanelState = {}) =>
  moduleMetadata({
    providers: [
      {
        provide: NotificationPanelService,
        useFactory: () => {
          const service = new NotificationPanelService();
          if (open) {
            service.open();
          }
          service.setSeverityFilter(severity);
          service.setSearchText(search);
          service.setUnreadCount(mockEvents.length);
          return service;
        },
      },
    ],
  });

const meta: Meta<NotificationPanelComponent> = {
  title: 'Organisms/NotificationPanel',
  component: NotificationPanelComponent,
  tags: ['autodocs'],
  decorators: [
    applicationConfig({
      providers: [provideRouter([])],
    }),
    moduleMetadata({
      imports: [CommonModule, NotificationPanelComponent],
    }),
  ],
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    events: {
      control: 'object',
      description: 'Array of notification events to display'
    }
  },
  render: (args) => ({
    props: args,
    imports: [CommonModule],
    template: '<tai-notification-panel [events]="events"></tai-notification-panel>',
  }),
};

export default meta;
type Story = StoryObj<NotificationPanelComponent>;

export const Default: Story = {
  args: {
    events: mockEvents
  },
  decorators: [withPanelState()],
};

export const PanelOpen: Story = {
  args: {
    events: mockEvents
  },
  decorators: [withPanelState()],
  play: async ({ canvasElement }) => {
    const panel = canvasElement.querySelector('.notification-panel');
    if (panel) {
      console.log('Panel is visible');
    }
  },
};

export const FilteredByCritical: Story = {
  args: {
    events: mockEvents
  },
  decorators: [withPanelState({ severity: 'critical' })],
};

export const WithSearchFilter: Story = {
  args: {
    events: mockEvents
  },
  decorators: [withPanelState({ search: 'permission' })],
};

export const EmptyState: Story = {
  args: {
    events: []
  },
  decorators: [withPanelState()],
};

export const PanelClosed: Story = {
  args: {
    events: mockEvents
  },
  decorators: [withPanelState({ open: false })],
};
