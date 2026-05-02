import type { Meta, StoryObj } from '@storybook/angular';
import { NotificationToggleComponent } from './notification-toggle.component';
import { NotificationPanelService } from '../../organisms/notification-panel/notification-panel.service';

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
  play: async ({ canvas }) => {
    const service = NotificationPanelService.prototype;
    service.setUnreadCount?.(0);
  },
};

export const WithUnread: Story = {
  play: async ({ canvas }) => {
    const service = NotificationPanelService.prototype;
    service.setUnreadCount?.(5);
  },
};

export const WithManyUnread: Story = {
  play: async ({ canvas }) => {
    const service = NotificationPanelService.prototype;
    service.setUnreadCount?.(15);
  },
};