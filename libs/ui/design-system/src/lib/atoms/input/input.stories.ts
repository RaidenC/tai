import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { expect, fn, userEvent, within } from '@storybook/test';
import { InputComponent } from './input.component';

const emailControl = new FormControl('', { nonNullable: true });
const formDisabledControl = new FormControl(
  { value: '', disabled: true },
  { nonNullable: true },
);
const valueChanged = fn();
const blurred = fn();

type InputStoryArgs = InputComponent & {
  formControl: FormControl<string>;
};

const meta: Meta<InputStoryArgs> = {
  title: 'Atoms/Input',
  component: InputComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, ReactiveFormsModule, InputComponent],
    }),
  ],
  args: {
    id: 'email',
    type: 'email',
    placeholder: 'name@example.com',
    autocomplete: 'email',
    invalid: false,
    formControl: emailControl,
  },
  render: (args) => ({
    props: {
      ...args,
      onValueChanged: valueChanged,
      onBlurred: blurred,
    },
    template: `
      <tai-input
        [id]="id"
        [type]="type"
        [placeholder]="placeholder"
        [autocomplete]="autocomplete"
        [invalid]="invalid"
        [describedBy]="describedBy"
        [value]="value"
        [disabled]="disabled"
        [formControl]="formControl"
        (valueChanged)="onValueChanged($event)"
        (blurred)="onBlurred()">
      </tai-input>
    `,
  }),
};

export default meta;
type Story = StoryObj<InputStoryArgs>;

export const Email: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox');

    emailControl.reset('');
    emailControl.markAsUntouched();
    valueChanged.mockClear();

    await expect(input).toHaveAttribute('id', 'email');
    await expect(input).toHaveAttribute('type', 'email');
    await expect(input).toHaveAttribute('placeholder', 'name@example.com');
    await expect(input).toHaveAttribute('autocomplete', 'email');
    await expect(input).toHaveAttribute('aria-invalid', 'false');

    await userEvent.type(input, 'admin@tai.com');

    await expect(input).toHaveValue('admin@tai.com');
    await expect(emailControl.value).toBe('admin@tai.com');
    await expect(valueChanged).toHaveBeenLastCalledWith('admin@tai.com');
  },
};

export const Invalid: Story = {
  args: {
    invalid: true,
    placeholder: 'Invalid state',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox');

    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input).toHaveClass('border-red-600');
  },
};

export const DisabledByInput: Story = {
  args: {
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox');

    await expect(input).toBeDisabled();
    await expect(input).toHaveClass('disabled:cursor-not-allowed');
    await expect(input).toHaveClass('disabled:bg-gray-100');
  },
};

export const DisabledByFormControl: Story = {
  args: {
    formControl: formDisabledControl,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('textbox')).toBeDisabled();
  },
};

export const Blurred: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox');

    emailControl.markAsUntouched();
    blurred.mockClear();

    await userEvent.click(input);
    await userEvent.tab();

    await expect(emailControl.touched).toBe(true);
    await expect(blurred).toHaveBeenCalledTimes(1);
  },
};

export const SafePlaceholderText: Story = {
  args: {
    placeholder: '<script>alert(1)</script>',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox');

    await expect(input).toHaveAttribute('placeholder', '<script>alert(1)</script>');
    await expect(canvasElement.querySelector('script')).toBeNull();
  },
};
