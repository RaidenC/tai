import { Meta, StoryObj } from '@storybook/angular';
import { expect, fn, userEvent, within } from '@storybook/test';
import {
  ConfirmationPanelComponent,
  ConfirmationPanelData,
} from './confirmation-panel.component';

const baseData: ConfirmationPanelData = {
  title: 'Approve User Registration',
  message:
    'Approve Jane Doe for access to the portal. This will grant platform access immediately.',
  confirm: {
    label: 'Approve User',
    tone: 'default',
  },
  cancel: {
    label: 'Cancel',
  },
};

const meta: Meta<ConfirmationPanelComponent> = {
  title: 'Molecules/Confirmation',
  component: ConfirmationPanelComponent,
  args: {
    data: baseData,
    actionSelected: fn(),
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<ConfirmationPanelComponent>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('tai-confirmation-panel')).toHaveClass('block');
  },
};

export const Danger: Story = {
  args: {
    data: {
      title: 'Delete User Account',
      message:
        'This action is permanent and cannot be undone. The user will lose access immediately.',
      confirm: {
        label: 'Delete Account',
        tone: 'danger',
      },
      cancel: {
        label: 'Keep Account',
      },
    } satisfies ConfirmationPanelData,
  },
};

export const LongMessage: Story = {
  args: {
    data: {
      title: 'Review administrative approval with a long but bounded heading',
      message:
        'This confirmation intentionally uses a longer message to verify wrapping behavior across narrow and wide layouts without overlapping adjacent content or hiding the action buttons from the user.',
      confirm: {
        label: 'Approve User',
        tone: 'default',
      },
      cancel: {
        label: 'Cancel',
      },
    } satisfies ConfirmationPanelData,
  },
};

export const Loading: Story = {
  args: {
    data: {
      ...baseData,
      confirm: {
        label: 'Approve User',
        tone: 'default',
        loading: true,
      },
    } satisfies ConfirmationPanelData,
  },
};

export const SecurityText: Story = {
  args: {
    data: {
      title: '<img src=x onerror=alert(1)>Confirm',
      message: '<script>alert(1)</script>',
      confirm: {
        label: 'Confirm',
        tone: 'default',
      },
      cancel: {
        label: 'Cancel',
      },
    } satisfies ConfirmationPanelData,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByTestId('modal-title')).toHaveTextContent('<img src=x onerror=alert(1)>Confirm');
    await expect(canvas.getByTestId('modal-message')).toHaveTextContent('<script>alert(1)</script>');
    await expect(canvasElement.querySelector('img')).toBeNull();
    await expect(canvasElement.querySelector('script')).toBeNull();
  },
};

export const Accessibility: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dialog = canvas.getByRole('dialog', { name: /Approve User Registration/i });
    const confirm = canvas.getByTestId('modal-confirm-button');
    const cancel = canvas.getByTestId('modal-cancel-button');

    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog).toHaveAttribute('aria-labelledby');
    await expect(dialog).toHaveAttribute('aria-describedby');
    await expect(confirm).toHaveAttribute('data-confirmation-focus', 'confirm');
    await expect(cancel).toHaveAttribute('data-confirmation-focus', 'cancel');
  },
};

export const InteractionAudit: Story = {
  args: {
    data: {
      title: 'Interaction Test',
      message: 'Click cancel to test callback',
      confirm: {
        label: 'Confirm',
        tone: 'default',
      },
      cancel: {
        label: 'Cancel',
      },
    } satisfies ConfirmationPanelData,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('dialog')).toBeInTheDocument();
    await userEvent.click(canvas.getByTestId('modal-cancel-button'));
  },
};
