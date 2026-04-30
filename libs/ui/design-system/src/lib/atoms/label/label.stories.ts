import type { Meta, StoryObj } from '@storybook/angular';
import { LabelComponent } from './label.component';

const meta: Meta<LabelComponent> = {
  title: 'Atoms/Label',
  component: LabelComponent,
  args: {
    forId: 'email',
    text: 'Corporate Email',
    required: false,
  },
};

export default meta;
type Story = StoryObj<LabelComponent>;

export const Default: Story = {};

export const Required: Story = {
  args: {
    text: 'Password',
    required: true,
  },
};
