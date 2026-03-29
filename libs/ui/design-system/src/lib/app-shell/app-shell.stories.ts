import type { Meta, StoryObj } from '@storybook/angular';
import { AppShellComponent } from './app-shell.component';
import { within, expect, fn } from '@storybook/test';

const meta: Meta<AppShellComponent> = {
  component: AppShellComponent,
  title: 'AppShellComponent',
  args: {
    logout: fn(),
  },
};
export default meta;
type Story = StoryObj<AppShellComponent>;

export const Primary: Story = {
  args: {
    user: { name: 'John Doe' },
    menuItems: [
      { label: 'Collections', link: '/collections' },
      { label: 'Payments', link: '/payments' },
    ],
  },
  render: (args) => ({
    props: args,
    template: `
      <tai-app-shell [user]="user" [menuItems]="menuItems" (logout)="logout()">
        <h1>Welcome to Portal</h1>
        <p>This is the main content area.</p>
      </tai-app-shell>
    `,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Check if sidebar and header elements are present
    const sidebar = canvas.getByRole('navigation');
    await expect(sidebar).toBeInTheDocument();

    const header = canvas.getByRole('banner');
    await expect(header).toBeInTheDocument();

    const mainContent = canvas.getByText(/Welcome to Portal/i);
    await expect(mainContent).toBeInTheDocument();

    // Verify interaction on nested components (User Profile initials)
    const userProfileTrigger = canvas.getByRole('button', {
      name: /User Profile/i,
    });
    await expect(userProfileTrigger).toHaveTextContent('JD');

    // Verify sidebar items
    const sidebarItems = canvas.getAllByRole('menuitem');
    await expect(sidebarItems.length).toBe(2);
  },
};
