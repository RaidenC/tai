import type { Meta, StoryObj } from '@storybook/angular';
import { NotificationToggleComponent } from './notification-toggle.component';

const meta: Meta<NotificationToggleComponent> = {
  component: NotificationToggleComponent,
  title: 'Molecules/NotificationToggle',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};
export default meta;
type Story = StoryObj<NotificationToggleComponent>;

export const NoUnread: Story = {
  args: {
    unreadCount: 0,
  },
};

export const WithUnread: Story = {
  args: {
    unreadCount: 5,
  },
};

export const WithManyUnread: Story = {
  args: {
    unreadCount: 15,
  },
};