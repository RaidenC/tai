import { type Meta, type StoryObj } from '@storybook/angular';
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

const meta: Meta<NotificationPanelComponent> = {
  title: 'Design System/NotificationPanel',
  component: NotificationPanelComponent,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    events: {
      control: 'object',
      description: 'Array of notification events to display'
    }
  },
};

export default meta;
type Story = StoryObj<NotificationPanelComponent>;

export const Default: Story = {
  args: {
    events: mockEvents
  },
  parameters: {
    onPanelService: new NotificationPanelService()
  },
  render: (args) => ({
    props: {
      ...args,
      panelService: new NotificationPanelService()
    },
    template: '<tai-notification-panel [events]="events"></tai-notification-panel>',
    styles: [':host { position: relative; height: 100vh; }']
  }),
  play: async ({ canvasElement }) => {
    const panelService = new NotificationPanelService();
    panelService.open();
  }
};

export const PanelOpen: Story = {
  args: {
    events: mockEvents
  },
  render: (args) => {
    const panelService = new NotificationPanelService();
    panelService.open();
    return {
      props: {
        ...args,
        panelService
      },
      template: '<tai-notification-panel [events]="events"></tai-notification-panel>',
      styles: [':host { position: relative; height: 100vh; }']
    };
  },
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
  render: (args) => {
    const panelService = new NotificationPanelService();
    panelService.open();
    panelService.setSeverityFilter('critical');
    return {
      props: {
        ...args,
        panelService
      },
      template: '<tai-notification-panel [events]="events"></tai-notification-panel>',
      styles: [':host { position: relative; height: 100vh; }']
    };
  },
};

export const WithSearchFilter: Story = {
  args: {
    events: mockEvents
  },
  render: (args) => {
    const panelService = new NotificationPanelService();
    panelService.open();
    panelService.setSearchText('login');
    return {
      props: {
        ...args,
        panelService
      },
      template: '<tai-notification-panel [events]="events"></tai-notification-panel>',
      styles: [':host { position: relative; height: 100vh; }']
    };
  },
};

export const EmptyState: Story = {
  args: {
    events: []
  },
  render: (args) => {
    const panelService = new NotificationPanelService();
    panelService.open();
    return {
      props: {
        ...args,
        panelService
      },
      template: '<tai-notification-panel [events]="events"></tai-notification-panel>',
      styles: [':host { position: relative; height: 100vh; }']
    };
  },
};

export const PanelClosed: Story = {
  args: {
    events: mockEvents
  },
  render: (args) => {
    const panelService = new NotificationPanelService();
    // Panel stays closed
    return {
      props: {
        ...args,
        panelService
      },
      template: '<tai-notification-panel [events]="events"></tai-notification-panel>',
      styles: [':host { position: relative; height: 100vh; }']
    };
  },
};