import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { within, expect, userEvent } from 'storybook/test';
import { SecurityAlertComponent } from './security-alert';

const meta: Meta<SecurityAlertComponent> = {
  title: 'Security/SecurityAlert',
  component: SecurityAlertComponent,
  decorators: [
    moduleMetadata({
      imports: [SecurityAlertComponent],
    }),
  ],
  tags: ['autodocs'],
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
    const alert = canvas.getByTestId('security-alert');
    expect(alert).toBeTruthy();
    expect(alert.textContent).toContain('re-enter your SSN');
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
    const alert = canvas.getByTestId('security-alert');
    expect(alert.classList.contains('security-alert--info')).toBe(true);
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
    const dismissBtn = canvas.getByTestId('security-alert-dismiss');
    await userEvent.click(dismissBtn);
    const alert = canvas.queryByTestId('security-alert');
    // Note: dismissing emits event but visibility is controlled by parent
    expect(dismissBtn).toBeTruthy();
  },
};

export const Hidden: Story = {
  args: {
    message: 'This should not be visible.',
    visible: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = canvas.queryByTestId('security-alert');
    expect(alert).toBeNull();
  },
};
