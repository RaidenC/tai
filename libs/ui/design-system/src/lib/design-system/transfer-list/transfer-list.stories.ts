import type { Meta, StoryObj } from '@storybook/angular';
import { TransferListComponent, TransferItem } from './transfer-list';

const meta: Meta<TransferListComponent<TransferItem>> = {
  title: 'Design System/TransferList',
  component: TransferListComponent,
  tags: ['autodocs'],
  argTypes: {
    density: {
      control: 'radio',
      options: ['compact', 'comfortable'],
    },
  },
};

export default meta;
type Story = StoryObj<TransferListComponent<TransferItem>>;

const MOCK_ITEMS = [
  { id: 1, name: 'User Management' },
  { id: 2, name: 'System Configuration' },
  { id: 3, name: 'Security Audit' },
  { id: 4, name: 'API Access' },
  { id: 5, name: 'Database Management' },
];

export const Default: Story = {
  args: {
    items: MOCK_ITEMS,
    initialAssignedIds: [1, 2],
    displayKey: 'name',
    trackKey: 'id',
    density: 'comfortable',
  },
};
