import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { NotificationToggleComponent } from './notification-toggle.component';
import { NotificationPanelService } from '../../organisms/notification-panel/notification-panel.service';
import { of } from 'rxjs';

const mockService = {
  unreadCount: of(0),
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setUnreadCount: () => {},
};

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
          useValue: mockService,
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
          useValue: { ...mockService, unreadCount: of(5) },
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
          useValue: { ...mockService, unreadCount: of(15) },
        },
      ],
    }),
  ],
};