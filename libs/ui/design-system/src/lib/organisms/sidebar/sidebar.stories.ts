import { type Meta, type StoryObj, applicationConfig, moduleMetadata } from '@storybook/angular';
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
    await expect(canvas.getByText('Collections')).toBeInTheDocument();
    await expect(canvas.getByText('Payments')).toBeInTheDocument();
    await expect(canvas.getByText('Settings')).toBeInTheDocument();
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
