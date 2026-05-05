import { type Meta, type StoryObj, applicationConfig, moduleMetadata } from '@storybook/angular';
import { provideRouter } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NotificationPanelComponent } from './notification-panel.component';
import { NotificationPanelService } from './notification-panel.service';
import { NotificationPanelItem } from './notification-panel.types';

const mockNotifications: NotificationPanelItem[] = [
  {
    id: '1',
    title: 'Login Anomaly Detected',
    summary: 'Suspicious login detected from unknown location',
    severity: 'critical',
    category: 'authentication',
    actor: 'user-1',
    timestamp: new Date().toISOString(),
    userId: 'user-1'
  },
  {
    id: '2',
    title: 'Security Alert',
    summary: 'Multiple failed login attempts',
    severity: 'critical',
    category: 'security',
    actor: 'user-2',
    timestamp: new Date(Date.now() - 60000).toISOString(),
    userId: 'user-2'
  },
  {
    id: '3',
    title: 'Privilege Modified',
    summary: 'Admin permissions granted',
    severity: 'critical',
    category: 'privilege',
    actor: 'user-3',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    userId: 'user-3'
  },
  {
    id: '4',
    title: 'Rate Limit Warning',
    summary: 'Rate limit approaching threshold',
    severity: 'warning',
    category: 'security',
    actor: 'user-4',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    userId: 'user-4'
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
          service.setUnreadCount(mockNotifications.length);
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
    notifications: {
      control: 'object',
      description: 'Array of notifications to display'
    }
  },
  render: (args) => ({
    props: args,
    imports: [CommonModule],
    template: '<tai-notification-panel [notifications]="notifications"></tai-notification-panel>',
  }),
};

export default meta;
type Story = StoryObj<NotificationPanelComponent>;

export const Default: Story = {
  args: {
    notifications: mockNotifications
  },
  decorators: [withPanelState()],
};

export const PanelOpen: Story = {
  args: {
    notifications: mockNotifications
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
    notifications: mockNotifications
  },
  decorators: [withPanelState({ severity: 'critical' })],
};

export const WithSearchFilter: Story = {
  args: {
    notifications: mockNotifications
  },
  decorators: [withPanelState({ search: 'permission' })],
};

export const EmptyState: Story = {
  args: {
    notifications: []
  },
  decorators: [withPanelState()],
};

export const PanelClosed: Story = {
  args: {
    notifications: mockNotifications
  },
  decorators: [withPanelState({ open: false })],
};
