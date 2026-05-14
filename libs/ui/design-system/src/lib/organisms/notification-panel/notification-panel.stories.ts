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
    userId: 'user-1',
    readAt: null,
    acknowledgedAt: null,
  },
  {
    id: '2',
    title: 'Security Alert',
    summary: 'Multiple failed login attempts',
    severity: 'critical',
    category: 'security',
    actor: 'user-2',
    timestamp: new Date(Date.now() - 60000).toISOString(),
    userId: 'user-2',
    readAt: null,
    acknowledgedAt: null,
  },
  {
    id: '3',
    title: 'Privilege Modified',
    summary: 'Admin permissions granted',
    severity: 'critical',
    category: 'privilege',
    actor: 'user-3',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    userId: 'user-3',
    readAt: null,
    acknowledgedAt: null,
  },
  {
    id: '4',
    title: 'Rate Limit Warning',
    summary: 'Rate limit approaching threshold',
    severity: 'warning',
    category: 'security',
    actor: 'user-4',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    userId: 'user-4',
    readAt: null,
    acknowledgedAt: null,
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
    },
    isLoading: {
      control: 'boolean',
      description: 'Whether notifications are loading'
    },
    error: {
      control: 'text',
      description: 'Error message to display'
    },
    isRetryThrottled: {
      control: 'boolean',
      description: 'Whether retry is throttled'
    }
  },
  render: (args) => ({
    props: args,
    imports: [CommonModule],
    template: '<tai-notification-panel [notifications]="notifications" [isLoading]="isLoading" [error]="error" [isRetryThrottled]="isRetryThrottled"></tai-notification-panel>',
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

export const Loading: Story = {
  args: {
    notifications: [],
    isLoading: true,
    error: null,
  },
  decorators: [withPanelState()],
};

export const EmptyAfterHydration: Story = {
  args: {
    notifications: [],
    isLoading: false,
    error: null,
  },
  decorators: [withPanelState()],
};

export const ErrorWithRetry: Story = {
  args: {
    notifications: [],
    isLoading: false,
    error: 'Unable to load recent notifications',
  },
  decorators: [withPanelState()],
};

export const PanelClosed: Story = {
  args: {
    notifications: mockNotifications
  },
  decorators: [withPanelState({ open: false })],
};

export const LifecycleStates: Story = {
  args: {
    notifications: [
      {
        id: 'evt-read',
        title: 'Privilege modified',
        summary: 'Trade approver privilege changed',
        severity: 'critical',
        category: 'privilege',
        actor: 'admin@tai.com',
        timestamp: new Date().toISOString(),
        userId: 'admin@tai.com',
        readAt: '2026-05-07T18:00:00.000Z',
        acknowledgedAt: '2026-05-07T18:01:00.000Z',
      },
      {
        id: 'evt-unread',
        title: 'Login Anomaly Detected',
        summary: 'Suspicious login detected from unknown location',
        severity: 'critical',
        category: 'authentication',
        actor: 'user-1',
        timestamp: new Date(Date.now() - 60000).toISOString(),
        userId: 'user-1',
        readAt: null,
        acknowledgedAt: null,
      },
      {
        id: 'evt-warning',
        title: 'Rate Limit Warning',
        summary: 'Rate limit approaching threshold',
        severity: 'warning',
        category: 'security',
        actor: 'user-4',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        userId: 'user-4',
        readAt: '2026-05-07T17:30:00.000Z',
        acknowledgedAt: null,
      },
    ],
  },
  decorators: [withPanelState()],
};
