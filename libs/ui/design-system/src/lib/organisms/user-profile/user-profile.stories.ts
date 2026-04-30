import type { Meta, StoryObj } from '@storybook/angular';
import { UserProfileComponent } from './user-profile.component';
import { within, userEvent, expect, fn } from '@storybook/test';

const meta: Meta<UserProfileComponent> = {
  component: UserProfileComponent,
  title: 'UserProfileComponent',
  args: {
    logout: fn(),
  },
};
export default meta;
type Story = StoryObj<UserProfileComponent>;

export const Primary: Story = {
  args: {
    user: { name: 'John Doe' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 1. Audit Identity Invariant: Initials Derivation
    // Proves that 'John Doe' is correctly transformed into 'JD' in the UI.
    const trigger = canvas.getByRole('button');
    await expect(trigger).toHaveTextContent('JD');

    // 2. Audit UI Logic: Menu Access
    // Proves that the interaction correctly triggers the CDK menu.
    await userEvent.click(trigger);

    // 3. Audit Content: Portal Rendering
    // Proves that the Logout button exists in the dynamic CDK portal overlay.
    const body = within(document.body);
    const logoutBtn = await body.findByText(/Logout/i);
    await expect(logoutBtn).toBeInTheDocument();
  },
};
