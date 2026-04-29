import type { Meta, StoryObj } from '@storybook/angular';
import { ButtonComponent } from './button.component';

const meta: Meta<ButtonComponent> = {
  title: 'Atoms/Button',
  component: ButtonComponent,
  args: {
    type: 'button',
    variant: 'primary',
    disabled: false,
  },
  render: (args) => ({
    props: args,
    template: `<tai-button [type]="type" [variant]="variant" [disabled]="disabled">Sign In</tai-button>`,
  }),
};

export default meta;
type Story = StoryObj<ButtonComponent>;

export const Primary: Story = {};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
  },
};
