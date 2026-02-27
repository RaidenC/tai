import type { Meta, StoryObj } from '@storybook/angular';
import { SidebarComponent } from './sidebar.component';
import { within, expect } from '@storybook/test';

const meta: Meta<SidebarComponent> = {
  component: SidebarComponent,
  title: 'SidebarComponent',
};
export default meta;
type Story = StoryObj<SidebarComponent>;

/**
 * UI Invariant Audit: Primary Expanded State
 * Proves that all menu items are correctly rendered with visible labels, 
 * ensuring a complete and accessible navigation experience for bank staff.
 */
export const Primary: Story = {
  args: {
    menuItems: [
      { label: 'Collections', link: '/collections' },
      { label: 'Payments', link: '/payments' },
      { label: 'Settings', link: '/settings' },
    ],
    collapsed: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Proves that the exact number of intended navigation tiles are rendered
    const menuItems = canvas.getAllByRole('menuitem');
    await expect(menuItems.length).toBe(3);

    // Proves that labels are visible in the expanded state for clarity
    await expect(canvas.getByText('Collections')).toBeInTheDocument();
    await expect(canvas.getByText('Payments')).toBeInTheDocument();
    await expect(canvas.getByText('Settings')).toBeInTheDocument();
  },
};

/**
 * UI Invariant Audit: Collapsed State
 * Proves that labels are hidden in the collapsed state to preserve 
 * dashboard real estate while maintaining structural navigation tiles.
 */
export const Collapsed: Story = {
  args: {
    menuItems: [
      { label: 'Collections', link: '/collections' },
      { label: 'Payments', link: '/payments' },
      { label: 'Settings', link: '/settings' },
    ],
    collapsed: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Proves that menu items still exist for icon-only navigation
    const menuItems = canvas.getAllByRole('menuitem');
    await expect(menuItems.length).toBe(3);

    // Proves that text labels are correctly hidden to avoid visual clutter
    await expect(canvas.queryByText('Collections')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Payments')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Settings')).not.toBeInTheDocument();
  },
};
