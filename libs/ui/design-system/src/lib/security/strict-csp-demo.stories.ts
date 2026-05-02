import type { Meta, StoryObj } from '@storybook/angular';
import { expect, within } from '@storybook/test';
import { DropdownMenuComponent, DropdownMenuItem } from '../molecules/dropdown-menu/dropdown-menu.component';
import { DataTableComponent, TableActionDef, TableColumnDef } from '../organisms/data-table/data-table';
import { SidebarComponent, MenuItem } from '../organisms/sidebar/sidebar.component';
import { UserProfileComponent } from '../organisms/user-profile/user-profile.component';

interface DemoRow {
  id: string;
  name: string;
  status: string;
}

const dropdownItems: DropdownMenuItem[] = [
  { id: 'view', label: 'View Details' },
  { id: 'archive', label: 'Archive' },
  { id: 'delete', label: 'Delete', destructive: true },
];

const rows: DemoRow[] = [
  { id: '1', name: 'Jane Smith', status: 'Active' },
  { id: '2', name: 'Alex Lee', status: 'Pending' },
];

const columns: TableColumnDef<DemoRow>[] = [
  { id: 'name', header: 'Name', cell: (row) => row.name, sortable: true },
  { id: 'status', header: 'Status', cell: (row) => row.status },
];

const actions: TableActionDef<DemoRow>[] = [
  { id: 'view', label: 'View Details' },
  { id: 'approve', label: 'Approve', visible: (row) => row.status === 'Pending' },
];

const navItems: MenuItem[] = [
  { label: 'Dashboard', link: '/dashboard', icon: 'D' },
  { label: 'Users', link: '/users', icon: 'U' },
];

const meta: Meta = {
  title: 'Security/StrictCspDemo',
  render: () => ({
    imports: [
      DropdownMenuComponent,
      DataTableComponent,
      SidebarComponent,
      UserProfileComponent,
    ],
    props: {
      dropdownItems,
      rows,
      columns,
      actions,
      navItems,
      violations: [] as SecurityPolicyViolationEvent[],
      onViolation(event: SecurityPolicyViolationEvent) {
        this['violations'].push(event);
      },
    },
    template: `
      <section
        class="grid gap-6 p-6"
        (securitypolicyviolation)="onViolation($event)"
        data-testid="strict-csp-demo"
      >
        <header>
          <h2 class="text-xl font-bold text-gray-900">Strict CSP Component Surface</h2>
          <p class="mt-1 text-sm text-gray-600">
            This story exercises local-DOM dropdown behavior without CDK menu or overlay primitives.
          </p>
        </header>

        <tai-dropdown-menu
          ariaLabel="Demo actions"
          triggerLabel="Actions"
          testId="strict-csp-dropdown"
          [items]="dropdownItems"
        />

        <tai-data-table
          [data]="rows"
          [columns]="columns"
          [actions]="actions"
          [totalCount]="rows.length"
        />

        <div class="flex items-start gap-6">
          <tai-sidebar [menuItems]="navItems" />
          <tai-user-profile [user]="{ name: 'Jane Smith' }" />
        </div>

        @if (violations.length > 0) {
          <div class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            CSP violations detected.
          </div>
        }
      </section>
    `,
  }),
};

export default meta;
type Story = StoryObj;

export const ComponentSurface: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Verify demo section exists
    await expect(canvas.getByTestId('strict-csp-demo')).toBeInTheDocument();

    // Verify heading exists
    await expect(canvas.getByRole('heading', { name: /Strict CSP Component Surface/i })).toBeInTheDocument();
  },
};
