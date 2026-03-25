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
  { id: 1, name: 'User Management', description: 'Manage users and roles' },
  { id: 2, name: 'System Configuration', description: 'Configure system settings' },
  { id: 3, name: 'Security Audit', description: 'View security logs' },
  { id: 4, name: 'API Access', description: 'Manage API keys' },
  { id: 5, name: 'Database Management', description: 'Manage database connections' },
  { id: 6, name: 'Email Services', description: 'Configure SMTP' },
  { id: 7, name: 'Storage Settings', description: 'Manage S3 buckets' },
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

export const Compact: Story = {
  args: {
    ...Default.args,
    density: 'compact',
  },
};

export const LargeDataset: Story = {
  args: {
    ...Default.args,
    items: Array.from({ length: 500 }, (_, i) => ({
      id: i + 1,
      name: `Permission Item ${i + 1}`,
      description: `Description for item ${i + 1}`,
    })),
    initialAssignedIds: [10, 20, 30, 40, 50],
  },
};

export const MobileView: Story = {
  args: {
    ...Default.args,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

export const CustomTemplate: Story = {
  render: (args) => ({
    props: args,
    template: `
      <tai-transfer-list
        [items]="items"
        [initialAssignedIds]="initialAssignedIds"
        [displayKey]="displayKey"
        [trackKey]="trackKey"
        [density]="density"
      >
        <ng-template #itemTemplate let-item>
          <div class="flex flex-col py-1">
            <span class="font-bold">{{ item.name }}</span>
            <span class="text-xs text-gray-500">{{ item.description }}</span>
          </div>
        </ng-template>
      </tai-transfer-list>
    `,
  }),
  args: {
    ...Default.args,
  },
};
