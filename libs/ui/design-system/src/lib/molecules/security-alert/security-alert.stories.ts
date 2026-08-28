import { moduleMetadata } from '@storybook/angular';
import type { Meta, StoryObj } from '@storybook/angular';
import { expect, fn, userEvent, within } from '@storybook/test';
import { SecurityAlertComponent } from './security-alert';

const dismissed = fn();

const meta: Meta<SecurityAlertComponent> = {
  title: 'Molecules/SecurityAlert',
  component: SecurityAlertComponent,
  decorators: [
    moduleMetadata({
      imports: [SecurityAlertComponent],
    }),
  ],
  tags: ['autodocs'],
  render: (args) => ({
    props: {
      ...args,
      onDismissed: dismissed,
    },
    template: `
      <tai-security-alert
        [message]="message"
        [severity]="severity"
        [visible]="visible"
        [dismissible]="dismissible"
        (dismissed)="onDismissed()"
      ></tai-security-alert>
    `,
  }),
};

export default meta;
type Story = StoryObj<SecurityAlertComponent>;

export const Warning: Story = {
  args: {
    message: 'For your security, please re-enter your SSN.',
    severity: 'warning',
    visible: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByRole('alert');

    await expect(alert).toBeVisible();
    await expect(alert).toHaveClass('security-alert--warning');
    await expect(alert).toHaveTextContent('re-enter your SSN');
  },
};

export const Info: Story = {
  args: {
    message: 'Draft saved locally (encrypted).',
    severity: 'info',
    visible: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByRole('alert');

    await expect(alert).toBeVisible();
    await expect(alert).toHaveClass('security-alert--info');
    await expect(alert).toHaveTextContent('Draft saved locally (encrypted).');
  },
};

export const Live: Story = {
  args: {
    message: 'Your identity was verified successfully.',
    severity: 'info',
    visible: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByRole('alert');

    await expect(alert).toHaveAttribute('aria-live', 'polite');
  },
};

export const Dismissible: Story = {
  args: {
    message: 'Session expired. Please re-authenticate.',
    severity: 'warning',
    visible: true,
    dismissible: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByRole('alert');
    const dismissBtn = canvas.getByRole('button', { name: 'Dismiss alert' });

    dismissed.mockClear();
    await expect(alert).toBeVisible();
    await expect(dismissBtn).toHaveTextContent('Dismiss');
    await userEvent.click(dismissBtn);
    await expect(dismissed).toHaveBeenCalledTimes(1);
  },
};

export const Hidden: Story = {
  args: {
    message: 'This should not be visible.',
    visible: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('alert')).toBeNull();
  },
};

export const SecurityStrings: Story = {
  args: {
    message: '<img src=x onerror=alert(1)><script>alert(1)</script>',
    severity: 'warning',
    visible: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByRole('alert');

    await expect(alert).toHaveTextContent('<img src=x onerror=alert(1)><script>alert(1)</script>');
    await expect(canvasElement.querySelector('img')).toBeNull();
    await expect(canvasElement.querySelector('script')).toBeNull();
  },
};
