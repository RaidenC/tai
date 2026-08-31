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

const loadingActionSelected = fn();
const confirmDisabledActionSelected = fn();
const cancelDisabledActionSelected = fn();
const confirmActionSelected = fn();
const cancelActionSelected = fn();

type ConfirmationStoryArgs = {
  data: ConfirmationPanelData;
};

const meta: Meta<ConfirmationStoryArgs> = {
  title: 'Molecules/Confirmation',
  component: ConfirmationPanelComponent,
  args: {
    data: baseData,
  },
  render: (args) => ({
    props: args,
    template: `
      <tai-confirmation-panel
        [data]="data"
        (actionSelected)="actionSelected($event)">
      </tai-confirmation-panel>
    `,
  }),
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<ConfirmationStoryArgs>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dialog = canvas.getByRole('dialog', { name: baseData.title });
    const title = canvas.getByTestId('modal-title');
    const message = canvas.getByTestId('modal-message');

    await expect(canvasElement.querySelector('tai-confirmation-panel')).toHaveClass('block');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog).toHaveAttribute('aria-labelledby', title.id);
    await expect(dialog).toHaveAttribute('aria-describedby', message.id);
    await expect(title).toHaveTextContent(baseData.title);
    await expect(message).toHaveTextContent(baseData.message);
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const cancel = canvas.getByRole('button', { name: 'Keep Account' });
    const confirm = canvas.getByRole('button', { name: 'Delete Account' });

    await expect(canvas.getByText('This action requires careful review.')).toBeInTheDocument();
    await expect(confirm).toHaveClass('bg-red-600');
    await expect(cancel).toHaveAttribute('data-focus-target', 'cancel');
  },
};

export const LongContent: Story = {
  args: {
    data: {
      title: 'Review administrative approval with a long but bounded heading that remains readable while preserving both action controls',
      message:
        'This confirmation intentionally uses a longer message to verify wrapping behavior across narrow and wide layouts without overlapping adjacent content or hiding the action buttons from the user. The action controls must remain available after the content wraps across multiple lines.',
      confirm: {
        label: 'Approve User',
        tone: 'default',
      },
      cancel: {
        label: 'Cancel',
      },
    } satisfies ConfirmationPanelData,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByTestId('modal-title')).toBeInTheDocument();
    await expect(canvas.getByTestId('modal-message')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Approve User' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
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
  render: (args) => ({
    props: { ...args, actionSelected: loadingActionSelected },
    template: `
      <tai-confirmation-panel
        [data]="data"
        (actionSelected)="actionSelected($event)">
      </tai-confirmation-panel>
    `,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const confirm = canvas.getByRole('button', { name: 'Working...' });
    const cancel = canvas.getByRole('button', { name: 'Cancel' });

    loadingActionSelected.mockClear();
    await expect(confirm).toHaveTextContent('Working...');
    await expect(confirm).toBeDisabled();
    await expect(cancel).toBeDisabled();
    await userEvent.click(confirm);
    await userEvent.click(cancel);
    await expect(loadingActionSelected).not.toHaveBeenCalled();
  },
};

export const ConfirmDisabled: Story = {
  args: {
    data: {
      ...baseData,
      confirm: {
        ...baseData.confirm,
        disabled: true,
      },
    } satisfies ConfirmationPanelData,
  },
  render: (args) => ({
    props: { ...args, actionSelected: confirmDisabledActionSelected },
    template: `
      <tai-confirmation-panel
        [data]="data"
        (actionSelected)="actionSelected($event)">
      </tai-confirmation-panel>
    `,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const confirm = canvas.getByRole('button', { name: 'Approve User' });
    const cancel = canvas.getByRole('button', { name: 'Cancel' });

    confirmDisabledActionSelected.mockClear();
    await expect(confirm).toBeDisabled();
    await userEvent.click(confirm);
    await expect(confirmDisabledActionSelected).not.toHaveBeenCalled();
    await expect(cancel).toBeEnabled();
    await userEvent.click(cancel);
    await expect(confirmDisabledActionSelected).toHaveBeenCalledTimes(1);
    await expect(confirmDisabledActionSelected).toHaveBeenCalledWith({ action: 'cancel' });
  },
};

export const CancelDisabled: Story = {
  args: {
    data: {
      ...baseData,
      cancel: {
        ...baseData.cancel,
        disabled: true,
      },
    } satisfies ConfirmationPanelData,
  },
  render: (args) => ({
    props: { ...args, actionSelected: cancelDisabledActionSelected },
    template: `
      <tai-confirmation-panel
        [data]="data"
        (actionSelected)="actionSelected($event)">
      </tai-confirmation-panel>
    `,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const confirm = canvas.getByRole('button', { name: 'Approve User' });
    const cancel = canvas.getByRole('button', { name: 'Cancel' });

    cancelDisabledActionSelected.mockClear();
    await expect(cancel).toBeDisabled();
    await userEvent.click(cancel);
    await expect(cancelDisabledActionSelected).not.toHaveBeenCalled();
    await expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    await expect(cancelDisabledActionSelected).toHaveBeenCalledTimes(1);
    await expect(cancelDisabledActionSelected).toHaveBeenCalledWith({ action: 'confirm' });
  },
};

export const EmptyValues: Story = {
  args: {
    data: {
      title: '   ',
      message: '',
      confirm: { label: '   ' },
      cancel: { label: '' },
    } satisfies ConfirmationPanelData,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('heading', { name: 'Confirm action' })).toBeInTheDocument();
    await expect(canvas.getByTestId('modal-message')).toHaveTextContent('Please review this action before continuing.');
    await expect(canvas.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  },
};

export const TruncatedText: Story = {
  args: {
    data: {
      ...baseData,
      title: 'T'.repeat(121),
      message: 'M'.repeat(501),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const title = canvas.getByTestId('modal-title');
    const message = canvas.getByTestId('modal-message');

    expect(title.textContent?.trim()).toHaveLength(120);
    expect(message.textContent?.trim()).toHaveLength(500);
    await expect(canvas.getByRole('button', { name: 'Approve User' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  },
};

export const InvalidValues: Story = {
  args: {
    data: {
      ...baseData,
      confirm: {
        label: 'Approve User',
        tone: 'invalid' as never,
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const confirm = canvas.getByRole('button', { name: 'Approve User' });

    await expect(confirm).toHaveClass('bg-blue-600');
    await expect(confirm).toHaveAttribute('data-focus-target', 'confirm');
    await expect(canvasElement.querySelector('[style]')).toBeNull();
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
    await expect(confirm).toHaveAttribute('data-focus-target', 'confirm');
    await expect(cancel).toHaveAttribute('data-focus-target', 'cancel');
    await expect(canvasElement.querySelector('[style]')).toBeNull();
  },
};

export const ButtonComposition: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const hosts = Array.from(canvasElement.querySelectorAll('tai-button'));
    const nativeButtons = canvasElement.querySelectorAll('button');

    await expect(hosts).toHaveLength(2);
    await expect(nativeButtons).toHaveLength(2);
    for (const host of hosts) {
      const nativeButton = host.querySelector('button');

      await expect(nativeButton).toBeInTheDocument();
      await expect(nativeButton).toHaveAccessibleName();
    }
    await expect(canvas.getByRole('button', { name: 'Approve User' })).toHaveAttribute(
      'data-testid',
      'modal-confirm-button',
    );
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toHaveAttribute(
      'data-testid',
      'modal-cancel-button',
    );
    await expect(canvas.getByTestId('modal-confirm-button')).toHaveAttribute(
      'data-focus-target',
      'confirm',
    );
    await expect(canvas.getByTestId('modal-cancel-button')).toHaveAttribute(
      'data-focus-target',
      'cancel',
    );
  },
};

export const ConfirmAction: Story = {
  args: {
    data: {
      ...baseData,
      confirm: {
        label: 'Confirm',
        tone: 'default',
      },
      cancel: {
        label: 'Cancel',
      },
    } satisfies ConfirmationPanelData,
  },
  render: (args) => ({
    props: { ...args, actionSelected: confirmActionSelected },
    template: `
      <tai-confirmation-panel
        [data]="data"
        (actionSelected)="actionSelected($event)">
      </tai-confirmation-panel>
    `,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    confirmActionSelected.mockClear();
    const confirm = canvas.getByRole('button', { name: 'Confirm' });
    await userEvent.click(confirm);
    await userEvent.click(confirm);
    await expect(confirmActionSelected).toHaveBeenCalledTimes(1);
    await expect(confirmActionSelected).toHaveBeenCalledWith({ action: 'confirm' });
  },
};

export const CancelAction: Story = {
  args: {
    data: {
      ...baseData,
      confirm: {
        label: 'Confirm',
        tone: 'default',
      },
      cancel: {
        label: 'Cancel',
      },
    } satisfies ConfirmationPanelData,
  },
  render: (args) => ({
    props: { ...args, actionSelected: cancelActionSelected },
    template: `
      <tai-confirmation-panel
        [data]="data"
        (actionSelected)="actionSelected($event)">
      </tai-confirmation-panel>
    `,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    cancelActionSelected.mockClear();
    const cancel = canvas.getByRole('button', { name: 'Cancel' });
    await userEvent.click(cancel);
    await userEvent.click(cancel);
    await expect(cancelActionSelected).toHaveBeenCalledTimes(1);
    await expect(cancelActionSelected).toHaveBeenCalledWith({ action: 'cancel' });
  },
};
