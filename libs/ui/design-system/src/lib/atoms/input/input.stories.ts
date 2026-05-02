import type { Meta, StoryObj } from '@storybook/angular';
import { InputComponent } from './input.component';

const meta: Meta<InputComponent> = {
  title: 'Atoms/Input',
  component: InputComponent,
  args: {
    id: 'email',
    type: 'email',
    placeholder: 'name@example.com',
    autocomplete: 'email',
    invalid: false,
  },
};

export default meta;
type Story = StoryObj<InputComponent>;

export const Email: Story = {};

export const Invalid: Story = {
  args: {
    invalid: true,
    placeholder: 'Invalid state',
  },
};
