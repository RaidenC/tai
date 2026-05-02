import type { Meta, StoryObj } from '@storybook/angular';
import { ToastComponent } from './toast.component';
import { ToastService } from './toast.service';

const meta: Meta<ToastComponent> = {
  component: ToastComponent,
  title: 'Molecules/Toast',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};
export default meta;
type Story = StoryObj<ToastComponent>;

export const Info: Story = {
  args: {
    // Storybook will handle the toast signal via the service
  },
  play: async () => {
    const toastService = new ToastService();
    toastService.show('This is an info message', 'info');
  },
};

export const Warning: Story = {
  args: {},
  play: async () => {
    const toastService = new ToastService();
    toastService.show('This is a warning message', 'warning');
  },
};

export const Critical: Story = {
  args: {},
  play: async () => {
    const toastService = new ToastService();
    toastService.show('This is a critical message', 'critical');
  },
};

export const Dismissible: Story = {
  args: {},
  play: async () => {
    const toastService = new ToastService();
    toastService.show('Click the X to dismiss', 'info');

    // Wait a moment for render then click close
    setTimeout(() => {
      const closeButton = canvasElement.querySelector('.toast-close') as HTMLButtonElement;
      if (closeButton) {
        closeButton.click();
      }
    }, 100);
  },
};