import type { Meta, StoryObj } from '@storybook/angular';
import { HelloWorldComponent } from './hello-world';

const meta: Meta<HelloWorldComponent> = {
  component: HelloWorldComponent,
  title: 'Hello World Component',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<HelloWorldComponent>;

export const Default: Story = {
  args: {},
};

export const WithName: Story = {
  args: {
    name: 'Storybook',
  },
};
