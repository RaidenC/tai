import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { within, expect } from '@storybook/test';
import { CryptoUnavailableComponent } from './crypto-unavailable';

const meta: Meta<CryptoUnavailableComponent> = {
  title: 'Molecules/CryptoUnavailable',
  component: CryptoUnavailableComponent,
  decorators: [
    moduleMetadata({
      imports: [CryptoUnavailableComponent],
    }),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<CryptoUnavailableComponent>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByRole('alert');

    await expect(alert).toHaveAttribute('aria-live', 'assertive');
    await expect(canvas.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Secure Connection Required',
    );
    await expect(alert).toHaveTextContent(
      'This application requires a secure browser environment to protect your data.',
    );
    await expect(alert).toHaveTextContent(
      'Please ensure you are accessing this application over HTTPS.',
    );
  },
};

export const CustomMessage: Story = {
  args: {
    message: 'WebView not supported. Please open in Chrome or Edge.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByRole('alert');

    await expect(alert).toHaveTextContent('WebView not supported. Please open in Chrome or Edge.');
    await expect(alert).not.toHaveTextContent(
      'This application requires a secure browser environment to protect your data.',
    );
  },
};

export const LiteralMessage: Story = {
  args: {
    message: '<img src=x onerror=alert(1)><script>alert(1)</script>Use a secure browser.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByRole('alert');
    const literalMessage =
      '<img src=x onerror=alert(1)><script>alert(1)</script>Use a secure browser.';

    await expect(alert).toHaveTextContent(literalMessage);
    await expect(canvasElement.querySelector('img')).toBeNull();
    await expect(canvasElement.querySelector('script')).toBeNull();
  },
};
