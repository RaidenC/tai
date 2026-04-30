import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { within, expect } from 'storybook/test';
import { CryptoUnavailableComponent } from './crypto-unavailable';

const meta: Meta<CryptoUnavailableComponent> = {
  title: 'Security/CryptoUnavailable',
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
    const el = canvas.getByTestId('crypto-unavailable');
    expect(el).toBeTruthy();
    expect(el.textContent).toContain('HTTPS');
  },
};

export const CustomMessage: Story = {
  args: {
    message: 'WebView not supported. Please open in Chrome or Edge.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const el = canvas.getByTestId('crypto-unavailable');
    expect(el.textContent).toContain('WebView not supported');
  },
};
