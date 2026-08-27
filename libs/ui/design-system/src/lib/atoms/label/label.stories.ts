import type { Meta, StoryObj } from '@storybook/angular';
import { expect, within } from '@storybook/test';
import { LabelComponent } from './label.component';

const meta: Meta<LabelComponent> = {
  title: 'Atoms/Label',
  component: LabelComponent,
  args: {
    forId: 'email',
    text: 'Corporate Email',
    required: false,
  },
};

export default meta;
type Story = StoryObj<LabelComponent>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const text = canvas.getByText('Corporate Email');
    const label = text.closest('label');
    await expect(canvasElement.querySelector('tai-label')).toHaveClass('inline-flex');

    await expect(text).toBeInTheDocument();
    await expect(label).toHaveAttribute('for', 'email');
    await expect(canvasElement.querySelector('[data-testid="required-marker"]')).toBeNull();
  },
};

export const Required: Story = {
  args: {
    text: 'Password',
    required: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const marker = canvas.getByTestId('required-marker');

    await expect(canvas.getByText('Password')).toBeInTheDocument();
    await expect(marker).toHaveTextContent('*');
    await expect(marker).toHaveAttribute('aria-hidden', 'true');
  },
};

export const WithoutTarget: Story = {
  args: {
    forId: '',
    text: 'Email',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const label = canvas.getByText('Email').closest('label');

    await expect(label).not.toHaveAttribute('for');
  },
};

export const EmptyText: Story = {
  args: {
    text: '',
  },
  play: async ({ canvasElement }) => {
    const label = canvasElement.querySelector('label');

    await expect(label).toBeInTheDocument();
    await expect(label).toHaveTextContent('');
  },
};

export const SpecialCharacters: Story = {
  args: {
    text: '<script>alert(1)</script>Name',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const text = '<script>alert(1)</script>Name';

    await expect(canvas.getByText(text)).toBeInTheDocument();
    await expect(canvasElement.querySelector('script')).toBeNull();
    await expect(canvasElement.querySelector('label span')).toHaveTextContent(text);
  },
};
