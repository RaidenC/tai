import { type Meta, type StoryObj } from '@storybook/angular';
import { fn, userEvent, within, expect } from '@storybook/test';
import { DropdownMenuComponent, DropdownMenuItem } from './dropdown-menu.component';

const items: DropdownMenuItem[] = [
  { id: 'profile', label: 'My Profile' },
  { id: 'settings', label: 'Account Settings' },
  { id: 'logout', label: 'Logout', destructive: true },
];

const meta: Meta<DropdownMenuComponent> = {
  title: 'Molecules/Dropdown Menu',
  component: DropdownMenuComponent,
  tags: ['autodocs'],
  args: {
    items,
    triggerLabel: 'Actions',
    ariaLabel: 'Actions',
    placement: 'bottom-end',
    mobileMode: 'sheet',
    density: 'comfortable',
    testId: 'story-dropdown',
    itemSelected: fn(),
  },
  render: (args) => ({
    props: args,
    template: `
      <tai-dropdown-menu
        [items]="items"
        [triggerLabel]="triggerLabel"
        [triggerIcon]="triggerIcon"
        [ariaLabel]="ariaLabel"
        [placement]="placement"
        [mobileMode]="mobileMode"
        [density]="density"
        [testId]="testId"
        (itemSelected)="itemSelected($event)">
      </tai-dropdown-menu>
    `,
  }),
};

export default meta;
type Story = StoryObj<DropdownMenuComponent>;

export const Default: Story = {};

export const Compact: Story = {
  args: {
    density: 'compact',
    triggerIcon: 'more-vertical',
    triggerLabel: '',
  },
};

export const OpensWithKeyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId('story-dropdown-trigger');
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByRole('menu')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await expect(trigger).toHaveFocus();
  },
};
