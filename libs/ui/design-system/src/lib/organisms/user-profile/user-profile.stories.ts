import type { Meta, StoryObj } from '@storybook/angular';
import { UserProfileComponent } from './user-profile.component';
import { expect, fn, userEvent, waitFor, within } from '@storybook/test';

const profileLogout = fn();

const meta: Meta<UserProfileComponent> = {
  component: UserProfileComponent,
  title: 'Organisms/UserProfile',
  args: {
    logout: profileLogout,
  },
  render: (args) => ({
    props: { ...args, logout: profileLogout },
    template: `
      <tai-user-profile [user]="user" (logout)="logout()"></tai-user-profile>
    `,
  }),
};
export default meta;
type Story = StoryObj<UserProfileComponent>;

export const Primary: Story = {
  args: {
    user: { name: 'John Doe' },
  },
  play: async ({ canvasElement }) => {
    profileLogout.mockClear();

    const canvas = within(canvasElement);

    // 1. Audit Identity Invariant: Initials Derivation
    // Proves that 'John Doe' is correctly transformed into 'JD' in the UI.
    const trigger = canvas.getByRole('button');
    await expect(trigger).toHaveTextContent('JD');

    // 2. Audit UI Logic: Menu Access
    // Proves that the interaction correctly triggers the CDK menu.
    await userEvent.click(trigger);

    // 3. Audit Content: Profile Actions
    // Proves that the consumer-visible profile actions are available.
    await waitFor(() =>
      expect(
        canvas.getByRole('menu', { name: 'User Profile' }),
      ).toBeInTheDocument(),
    );
    const logoutButton = canvas.getByRole('menuitem', { name: 'Logout' });
    await expect(logoutButton).toBeInTheDocument();

    // 4. Audit Output: User-Initiated Logout
    await userEvent.click(logoutButton);
    await expect(profileLogout).toHaveBeenCalledTimes(1);
  },
};

export const Avatar: Story = {
  args: {
    user: { name: 'Jane Doe', avatar: '/assets/jane-doe.png' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const avatar = canvas.getByRole('img', { name: 'Jane Doe' });

    await expect(avatar).toHaveAttribute('src', '/assets/jane-doe.png');
    await expect(avatar).toHaveAttribute('alt', 'Jane Doe');
  },
};

export const NoUser: Story = {
  args: {
    user: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'User Profile' });

    await expect(trigger).toBeInTheDocument();
    await expect(trigger).not.toHaveTextContent(/\S/);
    await expect(trigger.querySelector('img')).not.toBeInTheDocument();
  },
};

const untrustedName = '<img src=x onerror=alert(1)>Injected User';

export const UntrustedIdentity: Story = {
  args: {
    user: { name: untrustedName },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'User Profile' });

    await expect(trigger).toHaveTextContent('<U');
    await expect(trigger.querySelector('img')).not.toBeInTheDocument();
  },
};
