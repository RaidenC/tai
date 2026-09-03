import {
  type Meta,
  type StoryObj,
  applicationConfig,
  moduleMetadata,
} from '@storybook/angular';
import { CommonModule } from '@angular/common';
import { RouterModule, provideRouter } from '@angular/router';
import { expect, within } from '@storybook/test';
import { SidebarComponent, MenuItem } from './sidebar.component';

const sidebarMenuItems: MenuItem[] = [
  { label: 'Collections', link: '/collections' },
  { label: 'Payments', link: '/payments' },
  { label: 'Settings', link: '/settings' },
];

const meta: Meta<SidebarComponent> = {
  component: SidebarComponent,
  title: 'Organisms/Sidebar',
  tags: ['autodocs'],
  decorators: [
    applicationConfig({
      providers: [provideRouter([])],
    }),
    moduleMetadata({
      imports: [CommonModule, RouterModule, SidebarComponent],
    }),
  ],
};

export default meta;
type Story = StoryObj<SidebarComponent>;

export const Primary: Story = {
  args: {
    menuItems: sidebarMenuItems,
    collapsed: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getAllByRole('menuitem')).toHaveLength(3);
    for (const item of sidebarMenuItems) {
      const menuItem = canvas.getByRole('menuitem', { name: item.label });

      await expect(menuItem).toHaveTextContent(item.label);
      await expect(menuItem).toHaveAttribute(
        'href',
        `${window.location.origin}${item.link}`,
      );
      await expect(menuItem).toHaveAttribute('title', item.label);
    }
  },
};

export const Collapsed: Story = {
  args: {
    menuItems: sidebarMenuItems,
    collapsed: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getAllByRole('menuitem')).toHaveLength(3);
    await expect(canvas.queryByText('Collections')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Payments')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Settings')).not.toBeInTheDocument();
  },
};

export const Empty: Story = {
  args: {
    menuItems: [],
    collapsed: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole('navigation', { name: 'Main Navigation' }),
    ).toBeInTheDocument();
    await expect(canvas.getByText('Portal')).toBeInTheDocument();
    await expect(canvas.queryAllByRole('menuitem')).toHaveLength(0);
  },
};

const untrustedLabel = '<img src=x onerror=alert(1)>Injected';

export const UntrustedLabel: Story = {
  args: {
    menuItems: [{ label: untrustedLabel, link: '/security' }],
    collapsed: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const menuItem = canvas.getByRole('menuitem', { name: untrustedLabel });

    await expect(menuItem).toHaveTextContent(untrustedLabel);
    await expect(menuItem).toHaveAttribute('title', untrustedLabel);
    await expect(menuItem.querySelector('img')).not.toBeInTheDocument();
  },
};
