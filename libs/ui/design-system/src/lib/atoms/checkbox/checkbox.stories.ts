import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { expect, userEvent, within } from '@storybook/test';
import { CheckboxComponent } from './checkbox.component';

const defaultControl = new FormControl(false, { nonNullable: true });
const checkedControl = new FormControl(true, { nonNullable: true });
const disabledControl = new FormControl(
  { value: false, disabled: true },
  { nonNullable: true },
);
const touchedControl = new FormControl(false, { nonNullable: true });

type CheckboxStoryArgs = CheckboxComponent & {
  formControl: FormControl<boolean>;
};

const meta: Meta<CheckboxStoryArgs> = {
  title: 'Atoms/Checkbox',
  component: CheckboxComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, ReactiveFormsModule, CheckboxComponent],
    }),
  ],
  args: {
    id: 'select-row',
    ariaLabel: 'Select row',
    invalid: false,
    formControl: defaultControl,
  },
  render: (args) => ({
    props: args,
    template: `
      <tai-checkbox
        [id]="id"
        [ariaLabel]="ariaLabel"
        [invalid]="invalid"
        [formControl]="formControl">
      </tai-checkbox>
    `,
  }),
};

export default meta;
type Story = StoryObj<CheckboxStoryArgs>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkbox = canvas.getByRole('checkbox', { name: 'Select row' });
    await expect(canvasElement.querySelector('tai-checkbox')).toHaveClass('inline-flex');

    await expect(checkbox).toHaveAttribute('type', 'checkbox');
    await expect(checkbox).toHaveAttribute('id', 'select-row');
    await expect(checkbox).not.toBeChecked();

    defaultControl.reset(false);
    await userEvent.click(checkbox);
    await expect(checkbox).toBeChecked();
    await expect(defaultControl.value).toBe(true);

    await userEvent.click(checkbox);
    await expect(checkbox).not.toBeChecked();
    await expect(defaultControl.value).toBe(false);
  },
};

export const Checked: Story = {
  args: {
    formControl: checkedControl,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('checkbox', { name: 'Select row' })).toBeChecked();
  },
};

export const Disabled: Story = {
  args: {
    formControl: disabledControl,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkbox = canvas.getByRole('checkbox', { name: 'Select row' });

    await expect(checkbox).toBeDisabled();
    await expect(checkbox).toHaveClass('disabled:opacity-60');
    await expect(checkbox).toHaveClass('disabled:cursor-not-allowed');
  },
};

export const Invalid: Story = {
  args: {
    invalid: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkbox = canvas.getByRole('checkbox', { name: 'Select row' });

    await expect(checkbox).toHaveAttribute('aria-invalid', 'true');
    await expect(checkbox).toHaveClass('border-red-600');
  },
};

export const Touched: Story = {
  args: {
    formControl: touchedControl,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkbox = canvas.getByRole('checkbox', { name: 'Select row' });

    touchedControl.markAsUntouched();
    await userEvent.click(checkbox);
    await userEvent.tab();
    await expect(touchedControl.touched).toBe(true);
  },
};
