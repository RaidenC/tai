import type { Meta, StoryObj } from '@storybook/angular';
import { expect, fn, userEvent, within } from '@storybook/test';
import { ButtonComponent } from './button.component';

const pressed = fn();

const meta: Meta<ButtonComponent> = {
  title: 'Atoms/Button',
  component: ButtonComponent,
  args: {
    type: 'button',
    variant: 'primary',
    disabled: false,
  },
  render: (args) => ({
    props: {
      ...args,
      onPressed: pressed,
    },
    template: `<tai-button
      [type]="type"
      [variant]="variant"
      [disabled]="disabled"
      [ariaLabel]="ariaLabel"
      [testId]="testId"
      (pressed)="onPressed($event)">
      Sign In
    </tai-button>`,
  }),
};

export default meta;
type Story = StoryObj<ButtonComponent>;

export const Primary: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Sign In' });

    await expect(button).toHaveAttribute('type', 'button');
    await expect(button).toHaveTextContent('Sign In');
    await expect(button).toHaveClass('tai-button');
    await expect(button).toHaveClass('bg-blue-600');

    pressed.mockClear();
    await userEvent.click(button);
    await expect(pressed).toHaveBeenCalledTimes(1);
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Sign In' });

    await expect(button).toHaveClass('border-gray-300');
    await expect(button).toHaveClass('bg-white');
  },
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Sign In' })).toHaveClass('bg-transparent');
  },
};

export const Danger: Story = {
  args: {
    variant: 'danger',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Sign In' });

    await expect(button).toHaveClass('bg-red-600');
    await expect(button).toHaveClass('text-white');
  },
};

export const Submit: Story = {
  args: {
    type: 'submit',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Sign In' })).toHaveAttribute('type', 'submit');
  },
};

export const Reset: Story = {
  args: {
    type: 'reset',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Sign In' })).toHaveAttribute('type', 'reset');
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Sign In' });

    await expect(button).toBeDisabled();
    await expect(button).toHaveClass('disabled:opacity-60');
    await expect(button).toHaveClass('disabled:cursor-not-allowed');

    pressed.mockClear();
    await userEvent.click(button);
    await expect(pressed).not.toHaveBeenCalled();
  },
};

export const Accessible: Story = {
  args: {
    ariaLabel: 'Submit form',
    testId: 'submit-btn',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Submit form' });

    await expect(button).toHaveAttribute('aria-label', 'Submit form');
    await expect(button).toHaveAttribute('data-testid', 'submit-btn');
  },
};
