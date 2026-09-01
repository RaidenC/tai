import {
  type Meta,
  type StoryObj,
  applicationConfig,
  moduleMetadata,
} from '@storybook/angular';
import { expect, fn, type Mock, waitFor, within } from '@storybook/test';
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
  },
];

interface StoryPanelState {
  open?: boolean;
  severity?: 'all' | 'critical' | 'warning' | 'info';
  search?: string;
}

type NotificationEventSpies = {
  retry: Mock<() => void>;
  markRead: Mock<(notificationId: string) => void>;
  markAllRead: Mock<() => void>;
  acknowledge: Mock<(notificationId: string) => void>;
};

const createNotificationEventSpies = (): NotificationEventSpies => ({
  retry: fn<() => void>(),
  markRead: fn<(notificationId: string) => void>(),
  markAllRead: fn<() => void>(),
  acknowledge: fn<(notificationId: string) => void>(),
});

const withPanelState = ({
  open = true,
  severity = 'all',
  search = '',
}: StoryPanelState = {}) =>
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
      description: 'Array of notifications to display',
    },
    isLoading: {
      control: 'boolean',
      description: 'Whether notifications are loading',
    },
    hasHydrated: {
      control: 'boolean',
      description: 'Whether initial hydration has completed',
    },
    error: {
      control: 'text',
      description: 'Error message to display',
    },
    isRetryThrottled: {
      control: 'boolean',
      description: 'Whether retry is throttled',
    },
    connectionState: {
      control: 'select',
      options: ['connected', 'reconnecting', 'disconnected'],
      description: 'Connection state for banner display',
    },
    recoveryNotice: {
      control: 'text',
      description: 'Recovery notice message to display',
    },
  },
  render: (args) => ({
    props: { ...args, ...createNotificationEventSpies() },
    imports: [CommonModule],
    template: `
      <tai-notification-panel
        [notifications]="notifications"
        [isLoading]="isLoading"
        [hasHydrated]="hasHydrated"
        [error]="error"
        [isRetryThrottled]="isRetryThrottled"
        [connectionState]="connectionState"
        [recoveryNotice]="recoveryNotice"
        (retry)="retry()"
        (markRead)="markRead($event)"
        (markAllRead)="markAllRead()"
        (acknowledge)="acknowledge($event)">
      </tai-notification-panel>
    `,
  }),
};

export default meta;
type Story = StoryObj<NotificationPanelComponent>;

export const Default: Story = {
  args: {
    notifications: mockNotifications,
  },
  decorators: [withPanelState()],
};

export const PanelOpen: Story = {
  args: {
    notifications: mockNotifications,
  },
  decorators: [withPanelState()],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dialog = await waitFor(() =>
      canvas.getByRole('dialog', { name: 'Notifications' }),
    );
    const heading = canvas.getByRole('heading', { name: 'Notifications' });
    const searchField = canvas.getByRole('textbox', {
      name: 'Search notifications',
    });
    const severityFilterGroup = canvas.getByRole('group', {
      name: 'Filter notifications by severity',
    });

    await expect(dialog).toBeVisible();
    await expect(heading).toBeVisible();
    await expect(searchField).toBeVisible();
    await expect(severityFilterGroup).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Show all notifications' }),
    ).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Show critical notifications only' }),
    ).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Show warning notifications only' }),
    ).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Show info notifications only' }),
    ).toBeVisible();
    await waitFor(() => expect(searchField).toHaveFocus());
  },
};

export const FilteredByCritical: Story = {
  args: {
    notifications: mockNotifications,
  },
  decorators: [withPanelState({ severity: 'critical' })],
};

export const WithSearchFilter: Story = {
  args: {
    notifications: mockNotifications,
  },
  decorators: [withPanelState({ search: 'permission' })],
};

export const EmptyState: Story = {
  args: {
    notifications: [],
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
    notifications: mockNotifications,
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

export const Connected: Story = {
  args: {
    notifications: mockNotifications,
    connectionState: 'connected',
    hasHydrated: true,
  },
  decorators: [withPanelState()],
};

export const Reconnecting: Story = {
  args: {
    notifications: mockNotifications,
    connectionState: 'reconnecting',
    hasHydrated: true,
    isLoading: true,
  },
  decorators: [withPanelState()],
};

export const Disconnected: Story = {
  args: {
    notifications: mockNotifications,
    connectionState: 'disconnected',
    hasHydrated: true,
  },
  decorators: [withPanelState()],
};
