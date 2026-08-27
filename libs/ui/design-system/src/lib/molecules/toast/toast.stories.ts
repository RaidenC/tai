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
  selector: 'storybook-toast-host',
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

export const Info: Story = {
  render: () => ({
    template:
      '<storybook-toast-host message="This is an info message" severity="info"></storybook-toast-host>',
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('This is an info message')).toBeVisible();
    await expect(canvasElement.querySelector('.toast-info')).toBeTruthy();
  },
};

export const Warning: Story = {
  render: () => ({
    template:
      '<storybook-toast-host message="This is a warning message" severity="warning"></storybook-toast-host>',
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('This is a warning message')).toBeVisible();
    await expect(canvasElement.querySelector('.toast-warning')).toBeTruthy();
  },
};

export const Critical: Story = {
  render: () => ({
    template:
      '<storybook-toast-host message="This is a critical message" severity="critical"></storybook-toast-host>',
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('This is a critical message')).toBeVisible();
    await expect(canvasElement.querySelector('.toast-critical')).toBeTruthy();
  },
};

export const Dismissible: Story = {
  render: () => ({
    template:
      '<storybook-toast-host message="Click the X to dismiss" severity="info"></storybook-toast-host>',
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const closeButton = canvas.getByRole('button', { name: 'Dismiss' });

    await expect(closeButton).toBeVisible();
    await userEvent.click(closeButton);
    await expect(canvas.queryByText('Click the X to dismiss')).not.toBeInTheDocument();
  },
};
