import {
  type Meta,
  type StoryObj,
  applicationConfig,
  moduleMetadata,
} from '@storybook/angular';
import { signal } from '@angular/core';
import {
  expect,
  fn,
  type Mock,
  userEvent,
  waitFor,
  within,
} from '@storybook/test';
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

type NotificationPanelStoryArgs = Omit<
  NotificationPanelComponent,
  'retry' | 'markRead' | 'markAllRead' | 'acknowledge'
> &
  Partial<NotificationEventSpies>;

const createNotificationEventSpies = (
  existing: Partial<NotificationEventSpies> = {},
): NotificationEventSpies => ({
  retry: existing.retry ?? fn<() => void>(),
  markRead: existing.markRead ?? fn<(notificationId: string) => void>(),
  markAllRead: existing.markAllRead ?? fn<() => void>(),
  acknowledge: existing.acknowledge ?? fn<(notificationId: string) => void>(),
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

const meta: Meta<NotificationPanelStoryArgs> = {
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
    props: { ...args, ...createNotificationEventSpies(args) },
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
type Story = StoryObj<NotificationPanelStoryArgs>;

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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const notificationItems = canvas.getAllByRole('listitem');

    await expect(notificationItems).toHaveLength(3);
    await expect(canvas.getByText('Login Anomaly Detected')).toBeVisible();
    await expect(canvas.getByText('Security Alert')).toBeVisible();
    await expect(canvas.getByText('Privilege Modified')).toBeVisible();
    await expect(
      canvas.queryByText('Rate Limit Warning'),
    ).not.toBeInTheDocument();

    await expect(
      canvas.getByRole('button', { name: 'Show critical notifications only' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      canvas.getByRole('button', { name: 'Show all notifications' }),
    ).toHaveAttribute('aria-pressed', 'false');
    await expect(
      canvas.getByRole('button', { name: 'Show warning notifications only' }),
    ).toHaveAttribute('aria-pressed', 'false');
    await expect(
      canvas.getByRole('button', { name: 'Show info notifications only' }),
    ).toHaveAttribute('aria-pressed', 'false');
  },
};

export const WithSearchFilter: Story = {
  args: {
    notifications: mockNotifications,
  },
  decorators: [withPanelState({ search: 'permission' })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const searchField = canvas.getByRole('textbox', {
      name: 'Search notifications',
    });

    await expect(searchField).toHaveValue('permission');
    await expect(canvas.getAllByRole('listitem')).toHaveLength(1);
    await expect(canvas.getByText('Privilege Modified')).toBeVisible();
    await expect(
      canvas.queryByText('Login Anomaly Detected'),
    ).not.toBeInTheDocument();
    await expect(canvas.queryByText('Security Alert')).not.toBeInTheDocument();
    await expect(
      canvas.queryByText('Rate Limit Warning'),
    ).not.toBeInTheDocument();
  },
};

export const EmptyState: Story = {
  args: {
    notifications: [],
  },
  decorators: [withPanelState()],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const emptyCopy = canvas.getByText(
      'All caught up! No recent notifications',
    );
    const emptyState = emptyCopy.closest('[role="status"]');

    await expect(emptyCopy).toBeVisible();
    await expect(emptyState).not.toBeNull();
    if (!emptyState) {
      return;
    }
    await expect(emptyState).toHaveAttribute('aria-live', 'polite');
    await expect(canvas.queryByRole('list')).not.toBeInTheDocument();
  },
};

export const Loading: Story = {
  args: {
    notifications: [],
    isLoading: true,
    hasHydrated: true,
    connectionState: 'connected',
    error: null,
  },
  decorators: [withPanelState()],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dialog = canvas.getByRole('dialog', { name: 'Notifications' });
    const loadingCopy = canvas.getByText('Syncing notifications...');
    const loadingStatus = loadingCopy.closest('[role="status"]');

    await expect(dialog).toBeVisible();
    await expect(loadingCopy).toBeVisible();
    await expect(loadingStatus).not.toBeNull();
    if (!loadingStatus) {
      return;
    }
    await expect(loadingStatus).toHaveAttribute('role', 'status');
    await expect(loadingStatus).toHaveAttribute('aria-live', 'polite');
  },
};

export const EmptyAfterHydration: Story = {
  args: {
    notifications: [],
    isLoading: false,
    hasHydrated: true,
    error: null,
  },
  decorators: [withPanelState()],
  play: async (context) => {
    await EmptyState.play?.(context);

    const canvas = within(context.canvasElement);
    await expect(
      canvas.queryByRole('status', { name: 'Connection status' }),
    ).not.toBeInTheDocument();
  },
};

export const FilterAndSearch: Story = {
  args: {
    notifications: mockNotifications,
  },
  decorators: [withPanelState()],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dialog = await waitFor(() =>
      canvas.getByRole('dialog', { name: 'Notifications' }),
    );
    const criticalFilter = canvas.getByRole('button', {
      name: 'Show critical notifications only',
    });
    const searchField = canvas.getByRole('textbox', {
      name: 'Search notifications',
    });

    await userEvent.click(criticalFilter);
    await expect(criticalFilter).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getAllByRole('listitem')).toHaveLength(3);

    await userEvent.type(searchField, 'permission');
    await expect(searchField).toHaveValue('permission');
    await expect(canvas.getAllByRole('listitem')).toHaveLength(1);
    await expect(canvas.getByText('Privilege Modified')).toBeVisible();
    await expect(
      canvas.queryByText('Login Anomaly Detected'),
    ).not.toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(searchField).toHaveValue(''));
    await expect(dialog).toBeVisible();
    await expect(canvas.getAllByRole('listitem')).toHaveLength(3);
  },
};

export const ErrorWithRetry: Story = {
  args: {
    notifications: [],
    isLoading: false,
    error: 'Unable to load recent notifications',
    retry: fn<() => void>(),
  },
  decorators: [withPanelState()],
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByRole('alert');
    const retryButton = canvas.getByRole('button', { name: 'Retry' });

    await expect(alert).toBeVisible();
    await expect(alert).toHaveTextContent(
      'Unable to load recent notifications',
    );
    await expect(retryButton).toBeVisible();
    await userEvent.click(retryButton);
    await expect(args.retry).toHaveBeenCalledTimes(1);
  },
};

export const RecoveryNotice: Story = {
  args: {
    notifications: mockNotifications,
    hasHydrated: true,
    recoveryNotice: 'Notification updates have been restored.',
    retry: fn<() => void>(),
  },
  decorators: [withPanelState()],
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const status = canvas.getByRole('status');
    const retryButton = canvas.getByRole('button', { name: 'Retry' });

    await expect(status).toBeVisible();
    await expect(status).toHaveAttribute('aria-live', 'polite');
    await expect(status).toHaveTextContent(
      'Notification updates have been restored.',
    );
    await expect(retryButton).toBeVisible();
    await expect(retryButton).not.toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(retryButton);
    await expect(args.retry).toHaveBeenCalledTimes(1);
  },
};

export const RecoveryNoticeThrottled: Story = {
  args: {
    notifications: mockNotifications,
    hasHydrated: true,
    recoveryNotice: 'Notification updates have been restored.',
    isRetryThrottled: true,
    retry: fn<() => void>(),
  },
  decorators: [withPanelState()],
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const status = canvas.getByRole('status');
    const retryButton = canvas.getByRole('button', { name: 'Retry' });

    await expect(status).toHaveTextContent(
      'Notification updates have been restored.',
    );
    await expect(retryButton).toHaveAttribute('aria-disabled', 'true');
    await expect(canvas.getByText('Try again shortly.')).toBeVisible();
    await userEvent.click(retryButton);
    await expect(args.retry).not.toHaveBeenCalled();
  },
};

export const PanelClosed: Story = {
  args: {
    notifications: mockNotifications,
  },
  decorators: [withPanelState({ open: false })],
};

export const ClosePanel: Story = {
  args: {
    notifications: mockNotifications,
  },
  decorators: [withPanelState()],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const closeButton = canvas.getByRole('button', {
      name: 'Close notifications panel',
    });

    await expect(
      canvas.getByRole('dialog', { name: 'Notifications' }),
    ).toBeVisible();
    await userEvent.click(closeButton);
    await waitFor(() =>
      expect(
        canvas.queryByRole('dialog', { name: 'Notifications' }),
      ).not.toBeInTheDocument(),
    );
  },
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
    markRead: fn<(notificationId: string) => void>(),
    markAllRead: fn<() => void>(),
    acknowledge: fn<(notificationId: string) => void>(),
  },
  decorators: [withPanelState()],
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const [acknowledgedItem, unreadItem, readWarningItem] =
      canvas.getAllByRole('listitem');

    await expect(unreadItem).toHaveAccessibleName('Unread notification');
    await expect(unreadItem.querySelector('.unread-marker')).toBeVisible();
    await expect(
      within(unreadItem).getByText('Acknowledgement required'),
    ).toBeVisible();
    await expect(
      within(unreadItem).getByRole('button', {
        name: 'Mark notification as read',
      }),
    ).toBeVisible();
    await userEvent.click(
      within(unreadItem).getByRole('button', {
        name: 'Mark notification as read',
      }),
    );
    await expect(args.markRead).toHaveBeenCalledWith('evt-unread');

    await expect(acknowledgedItem).toHaveAccessibleName('Read notification');
    await expect(
      within(acknowledgedItem).queryByRole('button', {
        name: 'Mark notification as read',
      }),
    ).not.toBeInTheDocument();
    await expect(
      within(acknowledgedItem).getByLabelText('Acknowledged notification'),
    ).toBeVisible();
    await expect(
      within(acknowledgedItem).queryByRole('button', {
        name: 'Acknowledge critical notification',
      }),
    ).not.toBeInTheDocument();

    await expect(
      within(readWarningItem).queryByRole('button', {
        name: 'Mark notification as read',
      }),
    ).not.toBeInTheDocument();
    await expect(
      within(readWarningItem).queryByRole('button', {
        name: 'Acknowledge critical notification',
      }),
    ).not.toBeInTheDocument();

    await expect(
      within(unreadItem).getByRole('button', {
        name: 'Acknowledge critical notification',
      }),
    ).toBeVisible();
    await userEvent.click(
      within(unreadItem).getByRole('button', {
        name: 'Acknowledge critical notification',
      }),
    );
    await expect(args.acknowledge).toHaveBeenCalledWith('evt-unread');

    const markAllReadButton = canvas.getByRole('button', {
      name: 'Mark all notifications as read',
    });
    await expect(markAllReadButton).toBeEnabled();
    await userEvent.click(markAllReadButton);
    await expect(args.markAllRead).toHaveBeenCalledTimes(1);
  },
};

export const AllNotificationsRead: Story = {
  args: {
    notifications: mockNotifications.map((notification) => ({
      ...notification,
      readAt: '2026-05-07T18:00:00.000Z',
    })),
  },
  decorators: [withPanelState()],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole('button', { name: 'Mark all notifications as read' }),
    ).toBeDisabled();
  },
};

export const KeyboardNavigation: Story = {
  args: {
    notifications: mockNotifications,
  },
  decorators: [withPanelState()],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const items = canvas.getAllByRole('listitem');

    await userEvent.click(items[0]);
    await expect(items[0]).toHaveFocus();

    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(items[1]).toHaveFocus());
    await expect(items[0]).toHaveAttribute('tabindex', '-1');
    await expect(items[1]).toHaveAttribute('tabindex', '0');

    await userEvent.keyboard('{ArrowUp}');
    await waitFor(() => expect(items[0]).toHaveFocus());

    await userEvent.keyboard('{End}');
    await waitFor(() => expect(items[3]).toHaveFocus());
    await expect(items[3]).toHaveAttribute('tabindex', '0');

    await userEvent.keyboard('{Home}');
    await waitFor(() => expect(items[0]).toHaveFocus());
    await expect(items[0]).toHaveAttribute('tabindex', '0');
  },
};

export const SearchEscapeBehavior: Story = {
  args: {
    notifications: mockNotifications,
  },
  decorators: [withPanelState({ search: 'permission' })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const searchField = canvas.getByRole('textbox', {
      name: 'Search notifications',
    });

    await waitFor(() => expect(searchField).toHaveFocus());
    await expect(searchField).toHaveValue('permission');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(searchField).toHaveValue(''));
    await expect(
      canvas.getByRole('dialog', { name: 'Notifications' }),
    ).toBeVisible();

    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(
        canvas.queryByRole('dialog', { name: 'Notifications' }),
      ).not.toBeInTheDocument(),
    );
  },
};

export const FocusAfterLastNotificationRemoved: Story = {
  args: {
    notifications: [mockNotifications[0]],
    markAllRead: fn<() => void>(),
  },
  decorators: [withPanelState()],
  render: (args) => {
    const notificationsState = signal(args.notifications);
    const eventSpies = createNotificationEventSpies(args);
    const props = { ...args, ...eventSpies, notificationsState };
    const markAllRead = props.markAllRead;
    const markAllReadWithMutation = fn<() => void>();

    markAllReadWithMutation.mockImplementation(() => {
      markAllRead();
      notificationsState.set([]);
    });
    props.markAllRead = markAllReadWithMutation;

    return {
      props,
      imports: [CommonModule],
      template: `
        <tai-notification-panel
          [notifications]="notificationsState()"
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
    };
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const markAllReadButton = canvas.getByRole('button', {
      name: 'Mark all notifications as read',
    });
    const closeButton = canvas.getByRole('button', {
      name: 'Close notifications panel',
    });

    await userEvent.click(markAllReadButton);
    await expect(args.markAllRead).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(closeButton).toHaveFocus());
    await expect(
      canvas.getByText('All caught up! No recent notifications'),
    ).toBeVisible();
  },
};

export const Connected: Story = {
  args: {
    notifications: mockNotifications,
    connectionState: 'connected',
    hasHydrated: true,
  },
  decorators: [withPanelState()],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const status = canvas.getByRole('status', { name: 'Connection status' });

    await expect(status).toBeVisible();
    await expect(status).toHaveTextContent('Notifications are live.');
    await expect(canvas.getAllByRole('listitem')).toHaveLength(4);
  },
};

export const Reconnecting: Story = {
  args: {
    notifications: mockNotifications,
    connectionState: 'reconnecting',
    hasHydrated: true,
    isLoading: true,
  },
  decorators: [withPanelState()],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const syncingCopy = canvas.getByText('Syncing notifications...');
    const syncingStatus = syncingCopy.closest('[role="status"]');

    await expect(syncingCopy).toBeVisible();
    await expect(syncingStatus).not.toBeNull();
    if (!syncingStatus) {
      return;
    }
    await expect(syncingStatus).toHaveAttribute('aria-live', 'polite');
    await expect(canvas.getByText('Login Anomaly Detected')).toBeVisible();
  },
};

export const Disconnected: Story = {
  args: {
    notifications: mockNotifications,
    connectionState: 'disconnected',
    hasHydrated: true,
    retry: fn<() => void>(),
  },
  decorators: [withPanelState()],
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const status = canvas.getByRole('status', { name: 'Connection status' });
    const retryButton = canvas.getByRole('button', { name: 'Retry' });

    await expect(status).toBeVisible();
    await expect(status).toHaveTextContent(
      'Notification updates are offline. Recent items may be stale.',
    );
    await expect(retryButton).toBeVisible();
    await expect(retryButton).not.toBeDisabled();
    await userEvent.click(retryButton);
    await expect(args.retry).toHaveBeenCalledTimes(1);
  },
};

export const ThrottledRetry: Story = {
  args: {
    notifications: mockNotifications,
    connectionState: 'disconnected',
    hasHydrated: true,
    isRetryThrottled: true,
    retry: fn<() => void>(),
  },
  decorators: [withPanelState()],
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const retryButton = canvas.getByRole('button', { name: 'Retry' });

    await expect(retryButton).toHaveAttribute('aria-disabled', 'true');
    await expect(canvas.getByText('Try again shortly.')).toBeVisible();
    await userEvent.click(retryButton);
    await expect(args.retry).not.toHaveBeenCalled();
  },
};
