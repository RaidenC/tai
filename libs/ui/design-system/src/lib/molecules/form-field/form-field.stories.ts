import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { expect, userEvent, within } from '@storybook/test';
import { FormFieldComponent } from './form-field.component';
import { InputComponent } from '../../atoms/input/input.component';

const meta: Meta<FormFieldComponent> = {
  title: 'Molecules/FormField',
  component: FormFieldComponent,
  decorators: [
    moduleMetadata({
      imports: [InputComponent],
    }),
  ],
  args: {
    controlId: 'email',
    label: 'Corporate Email',
    hint: 'Use your company email.',
    error: '',
    required: true,
  },
  render: (args) => ({
    props: args,
    template: `
      <tai-form-field
        [controlId]="controlId"
        [label]="label"
        [hint]="hint"
        [error]="error"
        [required]="required"
      >
        <tai-input [id]="controlId" type="email" autocomplete="email" />
      </tai-form-field>
    `,
  }),
};

export default meta;
type Story = StoryObj<FormFieldComponent>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const formField = canvasElement.querySelector('tai-form-field');
    const input = canvas.getByRole('textbox', { name: /Corporate Email/ });

    await expect(input).toHaveAttribute('id', 'email');
    await expect(canvasElement.querySelector('label')).toHaveAttribute('for', 'email');
    await expect(canvas.getByTestId('required-marker')).toHaveTextContent('*');
    await expect(canvas.getByText('Use your company email.')).toBeVisible();
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();
    await expect(formField).toHaveClass('block');
    await expect(formField).toHaveClass('w-full');
    await expect(canvasElement.querySelector('.tai-form-field')).toBeTruthy();
    await expect(canvasElement.querySelector('tai-input')).toBeTruthy();

    await userEvent.type(input, 'employee@example.com');
    await expect(input).toHaveValue('employee@example.com');
  },
};

export const WithoutOptionalMessages: Story = {
  args: {
    hint: '',
    error: '',
    required: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('textbox', { name: /Corporate Email/ })).toBeVisible();
    await expect(canvas.queryByTestId('required-marker')).not.toBeInTheDocument();
    await expect(canvas.queryByTestId('form-field-hint')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();
  },
};

export const WithError: Story = {
  args: {
    error: 'A valid corporate email is required.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const error = canvas.getByRole('alert');

    await expect(error).toHaveTextContent('A valid corporate email is required.');
    await expect(error).toHaveAttribute('aria-live', 'polite');
  },
};

export const LiteralMessages: Story = {
  args: {
    hint: '<img src=x onerror=alert(1)>Use your company email.',
    error: '<script>alert(1)</script>A valid corporate email is required.',
    required: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const hint = '<img src=x onerror=alert(1)>Use your company email.';
    const error = '<script>alert(1)</script>A valid corporate email is required.';

    await expect(canvas.getByText(hint, { exact: true })).toBeVisible();
    await expect(canvas.getByRole('alert')).toHaveTextContent(error);
    await expect(canvasElement.querySelector('script')).toBeNull();
    await expect(canvasElement.querySelector('img')).toBeNull();
  },
};
