import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import {
  ConfirmationDialogComponent,
  ConfirmationDialogData,
} from './confirmation-dialog';
import { fn } from '@storybook/test';

const meta: Meta<ConfirmationDialogComponent> = {
  title: 'Molecules/ConfirmationDialogDeprecated',
  component: ConfirmationDialogComponent,
  decorators: [
    moduleMetadata({
      providers: [
        { provide: DialogRef, useValue: { close: fn() } },
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

export const CompatibilityWrapper: Story = {};
