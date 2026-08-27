import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { expect, userEvent, within } from '@storybook/test';
import { SecureInputComponent } from './secure-input';

const defaultControl = new FormControl('', { nonNullable: true });
const initialValueControl = new FormControl('existing value', { nonNullable: true });
const focusedControl = new FormControl('', { nonNullable: true });
const passwordControl = new FormControl('', { nonNullable: true });
const textControl = new FormControl('', { nonNullable: true });
const errorControl = new FormControl('', { nonNullable: true });
const disabledControl = new FormControl(
  { value: 'Locked data', disabled: true },
  { nonNullable: true },
);

type SecureInputStoryArgs = SecureInputComponent & {
  formControl: FormControl<string>;
};

const meta: Meta<SecureInputStoryArgs> = {
  title: 'Atoms/SecureInput',
  component: SecureInputComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, ReactiveFormsModule, SecureInputComponent],
    }),
  ],
  tags: ['autodocs'],
  args: {
    id: 'email',
    label: 'Email Address',
    type: 'email',
    placeholder: 'Enter your corporate email',
    errorMessage: '',
    formControl: defaultControl,
  },
  render: (args) => ({
    props: args,
    template: `
      <tai-secure-input
        [id]="id"
        [label]="label"
        [type]="type"
        [placeholder]="placeholder"
        [errorMessage]="errorMessage"
        [formControl]="formControl">
      </tai-secure-input>
    `,
  }),
};

export default meta;
type Story = StoryObj<SecureInputStoryArgs>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Email Address');

    defaultControl.reset('');
    defaultControl.markAsUntouched();

    await expect(input).toHaveAttribute('id', 'email');
    await expect(input).toHaveAttribute('type', 'email');
    await expect(input).toHaveAttribute('placeholder', 'Enter your corporate email');
    await expect(input).toHaveAttribute('autocomplete', 'email');
    await expect(input).toHaveAttribute('aria-invalid', 'false');

    await userEvent.type(input, 'admin@tai.com');

    await expect(input).toHaveValue('admin@tai.com');
    await expect(defaultControl.value).toBe('admin@tai.com');
  },
};

export const InitialValue: Story = {
  args: {
    label: 'Existing value',
    formControl: initialValueControl,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByLabelText('Existing value')).toHaveValue('existing value');
  },
};

export const Focused: Story = {
  args: {
    label: 'Focused Input',
    formControl: focusedControl,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Focused Input');

    await userEvent.click(input);
    await expect(input).toHaveFocus();
  },
};

export const PasswordState: Story = {
  args: {
    label: 'Password',
    type: 'password',
    placeholder: 'Enter password',
    formControl: passwordControl,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Password');

    passwordControl.reset('');
    await expect(input).toHaveAttribute('autocomplete', 'new-password');
    await expect(input).toHaveAttribute('type', 'password');

    await userEvent.type(input, 'Secret123!');

    await expect(input).toHaveValue('Secret123!');
    await expect(passwordControl.value).toBe('Secret123!');
  },
};

export const TextState: Story = {
  args: {
    label: 'Text Input',
    type: 'text',
    formControl: textControl,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByLabelText('Text Input')).toHaveAttribute('autocomplete', 'off');
    await expect(canvas.getByLabelText('Text Input')).toHaveAttribute('type', 'text');
  },
};

export const ErrorVisible: Story = {
  args: {
    label: 'Invalid Input',
    errorMessage: '<strong>XSS Attempt</strong> Blocked',
    formControl: errorControl,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Invalid Input');

    errorControl.reset('');
    errorControl.markAsUntouched();
    await userEvent.click(input);
    await userEvent.tab();

    const errorMessage = canvas.getByRole('alert');
    await expect(errorMessage).toHaveTextContent('<strong>XSS Attempt</strong> Blocked');
    await expect(errorMessage.querySelector('strong')).toBeNull();
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input).toHaveClass('border-red-600');
  },
};

export const Disabled: Story = {
  args: {
    label: 'Locked data',
    formControl: disabledControl,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByLabelText('Locked data')).toBeDisabled();
  },
};
