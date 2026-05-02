import type { Meta, StoryObj } from '@storybook/angular';
import { FormFieldComponent } from './form-field.component';
import { InputComponent } from '../../atoms/input/input.component';

const meta: Meta<FormFieldComponent> = {
  title: 'Molecules/FormField',
  component: FormFieldComponent,
  args: {
    controlId: 'email',
    label: 'Corporate Email',
    hint: 'Use your company email.',
    error: '',
    required: true,
  },
  render: (args) => ({
    props: args,
    imports: [FormFieldComponent, InputComponent],
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

export const Default: Story = {};

export const WithError: Story = {
  args: {
    error: 'A valid corporate email is required.',
  },
};
