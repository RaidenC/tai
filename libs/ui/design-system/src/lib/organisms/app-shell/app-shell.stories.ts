import {
  type Meta,
  type StoryObj,
  applicationConfig,
  moduleMetadata,
} from '@storybook/angular';
import { CommonModule } from '@angular/common';
import { RouterModule, provideRouter } from '@angular/router';
import { AppShellComponent } from './app-shell.component';
import { expect, fn, userEvent, waitFor, within } from '@storybook/test';

const appShellLogout = fn();

const meta: Meta<AppShellComponent> = {
  component: AppShellComponent,
  title: 'Organisms/AppShell',
  tags: ['autodocs'],
  decorators: [
    applicationConfig({
      providers: [provideRouter([])],
    }),
    moduleMetadata({
      imports: [CommonModule, RouterModule, AppShellComponent],
    }),
  ],
  args: {
    logout: appShellLogout,
  },
  render: (args) => ({
    props: { ...args, logout: appShellLogout },
    template: `
      <tai-app-shell [user]="user" [menuItems]="menuItems" (logout)="logout()">
        <h1>Welcome to Portal</h1>
        <p>This is the main content area.</p>
      </tai-app-shell>
    `,
  }),
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Check if sidebar and header elements are present
    const sidebar = canvas.getByRole('navigation');
    await expect(sidebar).toBeInTheDocument();

    const header = canvas.getByRole('banner');
    await expect(header).toBeInTheDocument();

    const mainContent = canvas.getByRole('heading', {
      name: /Welcome to Portal/i,
    });
    await expect(mainContent).toBeInTheDocument();

    // Verify interaction on nested components (User Profile initials)
    const userProfileTrigger = canvas.getByRole('button');
    await expect(userProfileTrigger).toHaveTextContent('JD');

    // Verify sidebar items
    const sidebarItems = canvas.getAllByRole('menuitem');
    await expect(sidebarItems.length).toBe(2);
  },
};

export const EmptyShell: Story = {
  args: {
    user: null,
    menuItems: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole('navigation', { name: 'Main Navigation' }),
    ).toBeInTheDocument();
    await expect(canvas.getByRole('banner')).toBeInTheDocument();
    await expect(
      canvas.getByRole('heading', { name: /Welcome to Portal/i }),
    ).toBeInTheDocument();
    await expect(canvas.queryAllByRole('menuitem')).toHaveLength(0);
    await expect(
      canvas.getByRole('button', { name: 'User Profile' }),
    ).toBeInTheDocument();
  },
};

export const Logout: Story = {
  args: {
    user: { name: 'John Doe' },
    menuItems: [
      { label: 'Collections', link: '/collections' },
      { label: 'Payments', link: '/payments' },
    ],
  },
  play: async ({ canvasElement }) => {
    appShellLogout.mockClear();

    const canvas = within(canvasElement);
    const profileTrigger = canvas.getByRole('button', {
      name: 'User Profile',
    });

    await userEvent.click(profileTrigger);
    await waitFor(() =>
      expect(
        canvas.getByRole('menu', { name: 'User Profile' }),
      ).toBeInTheDocument(),
    );
    await userEvent.click(canvas.getByRole('menuitem', { name: 'Logout' }));

    await expect(appShellLogout).toHaveBeenCalledTimes(1);
  },
};
