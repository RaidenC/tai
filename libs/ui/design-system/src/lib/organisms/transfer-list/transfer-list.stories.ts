import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { type Meta, moduleMetadata, type StoryObj } from '@storybook/angular';
import {
  expect,
  fn,
  type Mock,
  userEvent,
  waitFor,
  within,
} from '@storybook/test';
import { TransferListComponent, TransferItem } from './transfer-list';

interface PermissionItem extends TransferItem {
  name: string;
  description: string;
}

type TransferTelemetry = {
  action: 'transfer_single' | 'transfer_bulk' | 'reset';
  direction?: 'to_assigned' | 'to_available';
  id?: string | number;
  count?: number;
};

type TransferListStoryArgs = {
  items: PermissionItem[];
  manualIds?: (string | number)[];
  displayKey: keyof PermissionItem;
  trackKey: keyof PermissionItem;
  density: 'compact' | 'comfortable';
  isDisabled?: boolean;
  formControl?: FormControl<(string | number)[]>;
  assignedIdsChanged: Mock<(ids: (string | number)[]) => void>;
  actionTelemetry: Mock<(event: TransferTelemetry) => void>;
};

const MOCK_ITEMS: PermissionItem[] = [
  { id: 1, name: 'User Management', description: 'Manage users and roles' },
  {
    id: 2,
    name: 'System Configuration',
    description: 'Configure system settings',
  },
  { id: 3, name: 'Security Audit', description: 'View security logs' },
  { id: 4, name: 'API Access', description: 'Manage API keys' },
  {
    id: 5,
    name: 'Database Management',
    description: 'Manage database connections',
  },
  { id: 6, name: 'Email Services', description: 'Configure SMTP' },
  { id: 7, name: 'Storage Settings', description: 'Manage S3 buckets' },
];

const assignedIdsChanged = fn<(ids: (string | number)[]) => void>();
const actionTelemetry = fn<(event: TransferTelemetry) => void>();
const formControl = new FormControl<(string | number)[]>([2], {
  nonNullable: true,
});
const disabledFormControl = new FormControl<(string | number)[]>([2], {
  nonNullable: true,
});
disabledFormControl.disable();

const renderTransferList = (args: TransferListStoryArgs) => ({
  props: { ...args, assignedIdsChanged, actionTelemetry },
  template: `
    <tai-transfer-list
      [items]="items"
      [manualIds]="manualIds"
      [displayKey]="displayKey"
      [trackKey]="trackKey"
      [density]="density"
      [isDisabled]="isDisabled"
      (assignedIdsChanged)="assignedIdsChanged($event)"
      (actionTelemetry)="actionTelemetry($event)">
    </tai-transfer-list>
  `,
});

const renderWithFormControl =
  (control: FormControl<(string | number)[]>) =>
  (args: TransferListStoryArgs) => ({
    props: {
      ...args,
      formControl: control,
      assignedIdsChanged,
      actionTelemetry,
    },
    imports: [ReactiveFormsModule],
    template: `
      <tai-transfer-list
        [items]="items"
        [displayKey]="displayKey"
        [trackKey]="trackKey"
        [density]="density"
        [formControl]="formControl"
        (assignedIdsChanged)="assignedIdsChanged($event)"
        (actionTelemetry)="actionTelemetry($event)">
      </tai-transfer-list>
    `,
  });

const meta: Meta<TransferListStoryArgs> = {
  title: 'Organisms/TransferList',
  component: TransferListComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [ReactiveFormsModule, TransferListComponent],
    }),
  ],
  args: {
    items: MOCK_ITEMS,
    manualIds: [1, 2],
    displayKey: 'name',
    trackKey: 'id',
    density: 'comfortable',
    isDisabled: false,
    assignedIdsChanged,
    actionTelemetry,
  },
  argTypes: {
    density: {
      control: 'radio',
      options: ['compact', 'comfortable'],
    },
  },
  render: renderTransferList,
};

export default meta;
type Story = StoryObj<TransferListStoryArgs>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const available = canvas.getByRole('listbox', { name: 'Available Items' });
    const assigned = canvas.getByRole('listbox', { name: 'Assigned Items' });

    await expect(canvasElement.querySelector('tai-transfer-list')).toHaveClass(
      'block',
    );
    await expect(canvasElement.querySelector('tai-transfer-list')).toHaveClass(
      'w-full',
    );
    await expect(available).toBeVisible();
    await expect(assigned).toBeVisible();
    await expect(within(available).getAllByRole('option')).toHaveLength(5);
    await expect(within(assigned).getAllByRole('option')).toHaveLength(2);
    await expect(canvas.getByText('5 / 5')).toBeVisible();
    await expect(canvas.getByText('2 / 2')).toBeVisible();
  },
};

export const MoveAllToAssigned: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const moveAllRight = canvas.getByRole('button', {
      name: 'Move all to assigned',
    });

    assignedIdsChanged.mockClear();
    actionTelemetry.mockClear();
    await userEvent.click(moveAllRight);

    await expect(canvas.getByText('No items available')).toBeVisible();
    await expect(
      canvas.getByRole('listbox', { name: 'Assigned Items' }),
    ).toHaveTextContent('Storage Settings');
    await expect(assignedIdsChanged).toHaveBeenCalledWith([
      1, 2, 3, 4, 5, 6, 7,
    ]);
    await expect(actionTelemetry).toHaveBeenCalledWith({
      action: 'transfer_bulk',
      direction: 'to_assigned',
      count: 5,
    });
  },
};

export const SelectAndMove: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const available = within(
      canvas.getByRole('listbox', { name: 'Available Items' }),
    );

    assignedIdsChanged.mockClear();
    actionTelemetry.mockClear();
    await userEvent.click(
      available.getByRole('option', { name: 'Security Audit' }),
    );
    await userEvent.click(
      canvas.getByRole('button', { name: 'Move selected to assigned' }),
    );

    await expect(
      within(canvas.getByRole('listbox', { name: 'Assigned Items' })).getByRole(
        'option',
        { name: 'Security Audit' },
      ),
    ).toBeVisible();
    await expect(assignedIdsChanged).toHaveBeenCalledWith([1, 2, 3]);
    await expect(actionTelemetry).toHaveBeenCalledWith({
      action: 'transfer_single',
      direction: 'to_assigned',
      id: 3,
    });
  },
};

export const SearchFiltersVisibleItems: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const availableList = canvas.getByRole('listbox', {
      name: 'Available Items',
    });
    const search = canvas.getAllByRole('textbox')[0];

    await userEvent.type(search, 'security');
    await waitFor(() =>
      expect(within(availableList).getAllByRole('option')).toHaveLength(1),
    );
    await expect(
      within(availableList).getByRole('option', { name: 'Security Audit' }),
    ).toBeVisible();
    await expect(
      within(availableList).queryByRole('option', { name: 'API Access' }),
    ).toBeNull();
    await expect(canvas.getByText('1 / 5')).toBeVisible();
  },
};

export const DoubleClickMovesSingleItem: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const option = within(
      canvas.getByRole('listbox', { name: 'Available Items' }),
    ).getByRole('option', { name: 'Security Audit' });

    assignedIdsChanged.mockClear();
    actionTelemetry.mockClear();
    await userEvent.dblClick(option);

    await expect(
      within(canvas.getByRole('listbox', { name: 'Assigned Items' })).getByRole(
        'option',
        { name: 'Security Audit' },
      ),
    ).toBeVisible();
    await expect(assignedIdsChanged).toHaveBeenCalledWith([1, 2, 3]);
    await expect(actionTelemetry).toHaveBeenCalledWith({
      action: 'transfer_single',
      direction: 'to_assigned',
      id: 3,
    });
  },
};

export const ResetToInitialState: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const available = within(
      canvas.getByRole('listbox', { name: 'Available Items' }),
    );

    actionTelemetry.mockClear();
    await userEvent.dblClick(
      available.getByRole('option', { name: 'Security Audit' }),
    );
    const reset = canvas.getByRole('button', {
      name: 'Reset to initial state',
    });

    await expect(reset).toBeEnabled();
    await userEvent.click(reset);
    await expect(
      within(
        canvas.getByRole('listbox', { name: 'Available Items' }),
      ).getByRole('option', { name: 'Security Audit' }),
    ).toBeVisible();
    await expect(actionTelemetry).toHaveBeenLastCalledWith({ action: 'reset' });
  },
};

export const EmptyAvailableState: Story = {
  args: {
    manualIds: MOCK_ITEMS.map((item) => item.id),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No items available')).toBeVisible();
    await expect(
      canvas.getByRole('listbox', { name: 'Assigned Items' }),
    ).toHaveTextContent('Storage Settings');
  },
};

export const Disabled: Story = {
  args: {
    isDisabled: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getAllByRole('textbox')[0]).toBeDisabled();
    await expect(
      canvas.getByRole('button', { name: 'Move all to assigned' }),
    ).toBeDisabled();
    await expect(
      canvas.getByRole('button', { name: 'Move selected to assigned' }),
    ).toBeDisabled();
    await expect(
      canvas.getByRole('button', { name: 'Reset to initial state' }),
    ).toBeDisabled();
  },
};

export const Compact: Story = {
  args: {
    density: 'compact',
  },
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('.transfer-list-container');
    await expect(container).toHaveClass('density-compact');
    await expect(container).toBeVisible();
  },
};

export const LargeDataset: Story = {
  parameters: {
    test: {
      timeout: 30000,
    },
  },
  args: {
    items: Array.from({ length: 500 }, (_, i) => ({
      id: i + 1,
      name: `Permission Item ${i + 1}`,
      description: `Description for item ${i + 1}`,
    })),
    manualIds: [10, 20, 30, 40, 50],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const availableList = canvas.getByRole('listbox', {
      name: 'Available Items',
    });
    const viewport = availableList.parentElement as HTMLElement;

    await expect(viewport.clientHeight).toBe(256);
    await expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
    viewport.scrollTop = viewport.scrollHeight;
    await expect(viewport.scrollTop).toBeGreaterThan(0);
  },
};

export const CustomTemplate: Story = {
  render: (args) => ({
    props: { ...args, assignedIdsChanged, actionTelemetry },
    template: `
      <tai-transfer-list
        [items]="items"
        [manualIds]="manualIds"
        [displayKey]="displayKey"
        [trackKey]="trackKey"
        [density]="density"
        (assignedIdsChanged)="assignedIdsChanged($event)"
        (actionTelemetry)="actionTelemetry($event)">
        <ng-template #itemTemplate let-item>
          <div class="flex flex-col py-1">
            <span class="font-bold">{{ item.name }}</span>
            <span class="text-xs text-gray-500">{{ item.description }}</span>
          </div>
        </ng-template>
      </tai-transfer-list>
    `,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Manage users and roles')).toBeVisible();
    await expect(canvas.getByText('Configure system settings')).toBeVisible();
  },
};

export const FormControlIntegration: Story = {
  render: renderWithFormControl(formControl),
  args: {
    manualIds: undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    formControl.setValue([1, 2]);

    await waitFor(() =>
      expect(
        within(
          canvas.getByRole('listbox', { name: 'Assigned Items' }),
        ).getAllByRole('option'),
      ).toHaveLength(2),
    );
    await expect(
      within(canvas.getByRole('listbox', { name: 'Assigned Items' })).getByRole(
        'option',
        { name: 'User Management' },
      ),
    ).toBeVisible();

    formControl.markAsUntouched();
    await userEvent.dblClick(
      within(
        canvas.getByRole('listbox', { name: 'Available Items' }),
      ).getByRole('option', { name: 'Security Audit' }),
    );
    await waitFor(() => expect(formControl.value).toEqual([1, 2, 3]));
    await expect(formControl.touched).toBe(true);
  },
};

export const DisabledFormControl: Story = {
  render: renderWithFormControl(disabledFormControl),
  args: {
    manualIds: undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('textbox')[0]).toBeDisabled();
    await expect(
      canvas.getByRole('button', { name: 'Move all to assigned' }),
    ).toBeDisabled();
  },
};
