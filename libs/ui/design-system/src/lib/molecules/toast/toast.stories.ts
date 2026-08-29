import { Component, inject, Input, OnChanges, OnDestroy } from '@angular/core';
import {
  type Meta,
  type StoryObj,
  applicationConfig,
  moduleMetadata,
} from '@storybook/angular';
import { ToastComponent } from './toast.component';
import { Toast, ToastService } from './toast.service';
import { expect, userEvent, within } from '@storybook/test';

@Component({
  selector: 'tai-storybook-toast-host',
  standalone: true,
  imports: [ToastComponent],
  template: '<tai-toast />',
})
class ToastStoryHostComponent implements OnChanges, OnDestroy {
  @Input() message = '';
  @Input() severity: Toast['severity'] = 'info';

  private readonly toastService = inject(ToastService);

  ngOnChanges(): void {
    if (this.message) {
      this.toastService.show(this.message, this.severity);
    }
  }

  ngOnDestroy(): void {
    this.toastService.hide();
  }
}

const meta: Meta<ToastComponent> = {
  component: ToastComponent,
  title: 'Molecules/Toast',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    applicationConfig({ providers: [ToastService] }),
    moduleMetadata({ imports: [ToastStoryHostComponent] }),
  ],
};
export default meta;
type Story = StoryObj<ToastComponent>;

export const Empty: Story = {
  render: () => ({
    template: '<tai-storybook-toast-host></tai-storybook-toast-host>',
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const host = canvasElement.querySelector('tai-storybook-toast-host');
    const toastComponent = host?.querySelector('tai-toast');

    await expect(host).toBeInTheDocument();
    await expect(toastComponent).toBeInTheDocument();
    await expect(canvasElement.querySelector('.toast')).not.toBeInTheDocument();
    await expect(
      canvasElement.querySelector('.toast-message'),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: 'Dismiss' }),
    ).not.toBeInTheDocument();
  },
};

export const Info: Story = {
  render: () => ({
    template:
      '<tai-storybook-toast-host message="This is an info message" severity="info"></tai-storybook-toast-host>',
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const message = canvas.getByText('This is an info message');
    const dismissButton = canvas.getByRole('button', { name: 'Dismiss' });

    await expect(message).toBeVisible();
    await expect(message.closest('.toast')).toHaveClass('toast-info');
    await expect(dismissButton).toBeVisible();
  },
};

export const Warning: Story = {
  render: () => ({
    template:
      '<tai-storybook-toast-host message="This is a warning message" severity="warning"></tai-storybook-toast-host>',
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const message = canvas.getByText('This is a warning message');
    const dismissButton = canvas.getByRole('button', { name: 'Dismiss' });

    await expect(message).toBeVisible();
    await expect(message.closest('.toast')).toHaveClass('toast-warning');
    await expect(dismissButton).toBeVisible();
  },
};

export const Critical: Story = {
  render: () => ({
    template:
      '<tai-storybook-toast-host message="This is a critical message" severity="critical"></tai-storybook-toast-host>',
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const message = canvas.getByText('This is a critical message');
    const dismissButton = canvas.getByRole('button', { name: 'Dismiss' });

    await expect(message).toBeVisible();
    await expect(message.closest('.toast')).toHaveClass('toast-critical');
    await expect(dismissButton).toBeVisible();
  },
};

export const Dismissible: Story = {
  render: () => ({
    template:
      '<tai-storybook-toast-host message="Click the X to dismiss" severity="info"></tai-storybook-toast-host>',
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const closeButton = canvas.getByRole('button', { name: 'Dismiss' });

    await expect(canvas.getByText('Click the X to dismiss')).toBeVisible();
    await expect(closeButton).toBeVisible();
    await userEvent.click(closeButton);
    await expect(
      canvas.queryByText('Click the X to dismiss'),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: 'Dismiss' }),
    ).not.toBeInTheDocument();
  },
};
