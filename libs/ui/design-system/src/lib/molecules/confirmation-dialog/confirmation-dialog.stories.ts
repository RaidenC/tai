import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import {
  ConfirmationDialogComponent,
  ConfirmationDialogData,
} from './confirmation-dialog';
import { expect, fn, userEvent, within } from '@storybook/test';

const compatibilityClose = fn();
const confirmClose = fn();
const cancelClose = fn();

const meta: Meta<ConfirmationDialogComponent> = {
  title: 'Molecules/ConfirmationDialogDeprecated',
  component: ConfirmationDialogComponent,
  decorators: [
    moduleMetadata({
      providers: [
        { provide: DialogRef, useValue: { close: compatibilityClose } },
        {
          provide: DIALOG_DATA,
          useValue: {
            title: 'Confirm Action',
            message:
              'This deprecated wrapper preserves the legacy tai-confirmation-dialog selector during migration.',
            confirmText: 'Confirm',
            cancelText: 'Cancel',
            confirmButtonClass: 'bg-indigo-600 hover:bg-indigo-700',
          } satisfies ConfirmationDialogData,
        },
      ],
    }),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<ConfirmationDialogComponent>;

export const CompatibilityWrapper: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvasElement.querySelector('tai-confirmation-dialog')).toBeInTheDocument();
    await expect(canvas.getByRole('heading', { name: 'Confirm Action' })).toBeInTheDocument();
    await expect(canvas.getByTestId('modal-message')).toHaveTextContent(
      'This deprecated wrapper preserves the legacy tai-confirmation-dialog selector during migration.',
    );
    const confirm = canvas.getByRole('button', { name: 'Confirm' });
    await expect(confirm).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    await expect(confirm).not.toHaveClass('bg-indigo-600');
    await expect(confirm).not.toHaveClass('hover:bg-indigo-700');
    await expect(confirm).toHaveClass('bg-blue-600');
  },
};

export const ConfirmAction: Story = {
  decorators: [
    moduleMetadata({
      providers: [{ provide: DialogRef, useValue: { close: confirmClose } }],
    }),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    confirmClose.mockClear();
    await expect(canvas.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Confirm' }));
    await expect(confirmClose).toHaveBeenCalledTimes(1);
    await expect(confirmClose).toHaveBeenCalledWith(true);
  },
};

export const CancelAction: Story = {
  decorators: [
    moduleMetadata({
      providers: [{ provide: DialogRef, useValue: { close: cancelClose } }],
    }),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    cancelClose.mockClear();
    await expect(canvas.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
    await expect(cancelClose).toHaveBeenCalledTimes(1);
    await expect(cancelClose).toHaveBeenCalledWith(false);
  },
};
