import type { Meta, StoryObj } from '@storybook/angular';
import { expect, fn, userEvent, within } from '@storybook/test';
import { NotificationToggleComponent } from './notification-toggle.component';

const toggled = fn();

const meta: Meta<NotificationToggleComponent> = {
  component: NotificationToggleComponent,
  title: 'Molecules/NotificationToggle',
  tags: ['autodocs'],
  args: {
    unreadCount: 0,
    isOpen: false,
    connectionState: 'connected',
    placement: 'bottom-right',
  },
  parameters: {
    layout: 'fullscreen',
  },
  render: (args) => ({
    props: {
      ...args,
      onToggled: toggled,
    },
    template: `
      <tai-notification-toggle
        [unreadCount]="unreadCount"
        [isOpen]="isOpen"
        [connectionState]="connectionState"
        [placement]="placement"
        (toggled)="onToggled()">
      </tai-notification-toggle>
      <div id="notification-panel" hidden></div>
    `,
  }),
};
export default meta;
type Story = StoryObj<NotificationToggleComponent>;

export const NoUnread: Story = {
  args: {
    unreadCount: 0,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Toggle notifications' });

    await expect(button).toHaveAttribute('type', 'button');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(button).toHaveAttribute('aria-controls', 'notification-panel');
    await expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    await expect(canvasElement.querySelector('tai-notification-toggle')).toHaveClass('right-6');
    await expect(canvasElement.querySelector('tai-notification-toggle')).toHaveClass('bottom-6');
    await expect(canvasElement.querySelector('.unread-badge')).toBeNull();
    await expect(canvasElement.querySelector('.connection-indicator')).toBeNull();

    toggled.mockClear();
    await userEvent.click(button);
    await expect(toggled).toHaveBeenCalledTimes(1);
  },
};

export const TopLeft: Story = {
  args: {
    placement: 'top-left',
  },
  play: async ({ canvasElement }) => {
    const toggle = canvasElement.querySelector('tai-notification-toggle');

    await expect(toggle).toHaveClass('top-6');
    await expect(toggle).toHaveClass('left-6');
    await expect(toggle).not.toHaveClass('bottom-6');
    await expect(toggle).not.toHaveClass('right-6');
  },
};

export const WithUnread: Story = {
  args: {
    unreadCount: 5,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const badge = canvas.getByText('5', { exact: true });

    await expect(badge).toHaveClass('unread-badge');
  },
};

export const WithManyUnread: Story = {
  args: {
    unreadCount: 15,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('9+', { exact: true })).toHaveClass('unread-badge');
  },
};

export const Open: Story = {
  args: {
    isOpen: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('button', { name: 'Toggle notifications' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  },
};

export const Reconnecting: Story = {
  args: {
    connectionState: 'reconnecting',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', {
      name: 'Toggle notifications, updates reconnecting',
    });
    const indicator = canvasElement.querySelector('.connection-indicator');

    await expect(button).toHaveAttribute('aria-label', 'Toggle notifications, updates reconnecting');
    await expect(indicator).not.toBeNull();
    await expect(indicator).toHaveClass('bg-amber-700');
    await expect(indicator).toHaveAttribute('aria-hidden', 'true');
  },
};

export const Disconnected: Story = {
  args: {
    connectionState: 'disconnected',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', {
      name: 'Toggle notifications, updates offline',
    });
    const indicator = canvasElement.querySelector('.connection-indicator');

    await expect(button).toHaveAttribute('aria-label', 'Toggle notifications, updates offline');
    await expect(indicator).not.toBeNull();
    await expect(indicator).toHaveClass('bg-red-700');
    await expect(indicator).toHaveAttribute('aria-hidden', 'true');
  },
};
