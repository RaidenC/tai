import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { expect, fn, userEvent, within } from '@storybook/test';
import {
  PendingApprovalsTileComponent,
  PendingUser,
} from './pending-approvals-tile';
import { CommonModule } from '@angular/common';

/**
 * Storybook Configuration: PendingApprovalsTileComponent
 *
 * Audit Proof: This story demonstrates the administrative approval
 * interface, ensuring that Tenant Admins can clearly identify
 * pending users and trigger the secondary approval action.
 */
const approved = fn();

type PendingApprovalsTileStoryArgs = {
  users: PendingUser[];
};

const meta: Meta<PendingApprovalsTileStoryArgs> = {
  title: 'Molecules/PendingApprovalsTile',
  component: PendingApprovalsTileComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule],
    }),
  ],
  render: (args) => ({
    props: {
      ...args,
      onApproved: approved,
    },
    template: `
      <tai-pending-approvals-tile
        [users]="users"
        (approved)="onApproved($event)">
      </tai-pending-approvals-tile>
    `,
  }),
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<PendingApprovalsTileStoryArgs>;

export const Default: Story = {
  args: {
    users: [
      { id: '1', email: 'jdoe@example.com', name: 'Jane Doe' },
      { id: '2', email: 'smith@example.com', name: 'John Smith' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole('heading', { name: 'Pending Approvals' }),
    ).toBeVisible();
    await expect(canvas.getByText('2 Awaiting', { exact: true })).toBeVisible();
    await expect(canvas.getByRole('table')).toBeVisible();
    await expect(
      canvas.getByRole('columnheader', { name: 'User' }),
    ).toBeVisible();
    await expect(
      canvas.getByRole('columnheader', { name: 'Email' }),
    ).toBeVisible();
    await expect(
      canvas.getByRole('columnheader', { name: 'Actions' }),
    ).toBeVisible();
    await expect(canvas.getByRole('cell', { name: 'Jane Doe' })).toBeVisible();
    await expect(
      canvas.getByRole('cell', { name: 'jdoe@example.com' }),
    ).toBeVisible();
    await expect(
      canvas.getByRole('cell', { name: 'John Smith' }),
    ).toBeVisible();
    await expect(
      canvas.getByRole('cell', { name: 'smith@example.com' }),
    ).toBeVisible();
  },
};

export const Empty: Story = {
  args: {
    users: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('0 Awaiting', { exact: true })).toBeVisible();
    await expect(
      canvas.getByText('All clear! No pending approvals.'),
    ).toBeVisible();
    await expect(canvas.queryByRole('table')).not.toBeInTheDocument();
  },
};

/**
 * Approval Action Audit:
 * This test verifies that the approval interface correctly
 * triggers the approval event for a specific user ID.
 */
export const ApprovalAudit: Story = {
  args: {
    ...Default.args,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const approveButtons = canvas.getAllByRole('button', { name: 'Approve' });

    await expect(canvasElement.querySelectorAll('tai-button')).toHaveLength(2);
    await expect(canvas.getAllByTestId('approve-button')).toHaveLength(2);
    await expect(approveButtons).toHaveLength(2);

    approved.mockClear();
    await userEvent.click(approveButtons[0]);
    await expect(approved).toHaveBeenCalledTimes(1);
    await expect(approved).toHaveBeenCalledWith('1');
  },
};
