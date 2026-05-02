import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { NotificationToggleComponent } from './notification-toggle.component';
import { NotificationPanelService } from '../../organisms/notification-panel/notification-panel.service';
import { of } from 'rxjs';

const meta: Meta<NotificationToggleComponent> = {
  component: NotificationToggleComponent,
  title: 'Molecules/NotificationToggle',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: NotificationPanelService,
          useValue: {
            unreadCount: of(0),
            setUnreadCount: () => {},
          },
        },
      ],
    }),
  ],
};
export default meta;
type Story = StoryObj<NotificationToggleComponent>;

export const NoUnread: Story = {};

export const WithUnread: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: NotificationPanelService,
          useValue: {
            unreadCount: of(5),
            setUnreadCount: () => {},
          },
        },
      ],
    }),
  ],
};

export const WithManyUnread: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: NotificationPanelService,
          useValue: {
            unreadCount: of(15),
            setUnreadCount: () => {},
          },
        },
      ],
    }),
  ],
};