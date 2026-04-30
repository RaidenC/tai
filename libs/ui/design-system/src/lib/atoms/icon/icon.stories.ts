import type { Meta, StoryObj } from '@storybook/angular';
import { IconComponent } from './icon.component';

const meta: Meta<IconComponent> = {
  title: 'Atoms/Icon',
  component: IconComponent,
  args: {
    name: 'more-vertical',
    size: 'md',
    decorative: true,
  },
};

export default meta;
type Story = StoryObj<IconComponent>;

export const MoreVertical: Story = {};

export const Sort: Story = {
  args: {
    name: 'chevron-up-down',
    decorative: false,
    ariaLabel: 'Sort',
  },
};
