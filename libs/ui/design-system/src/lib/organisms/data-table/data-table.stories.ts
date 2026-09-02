import { Meta, StoryObj } from '@storybook/angular';
import { CommonModule } from '@angular/common';
import { signal } from '@angular/core';
import {
  DataTableComponent,
  TableColumnDef,
  TableActionDef,
} from './data-table';
import {
  expect,
  fn,
  type Mock,
  userEvent,
  waitFor,
  within,
} from '@storybook/test';

/**
 * Test data interface for DataTable stories.
 */
interface TestData {
  id: string;
  name: string;
  email: string;
  status: 'Active' | 'Pending';
}

/**
 * Sample column definitions.
 */
const columns: TableColumnDef<TestData>[] = [
  { id: 'name', header: 'Name', cell: (row) => row.name, sortable: true },
  { id: 'email', header: 'Email', cell: (row) => row.email, sortable: true },
  { id: 'status', header: 'Status', cell: (row) => row.status },
];

/**
 * Sample action definitions.
 */
const actions: TableActionDef<TestData>[] = [
  {
    id: 'approve',
    label: 'Approve',
    visible: (row) => row.status === 'Pending',
  },
  { id: 'edit', label: 'Edit' },
];

/**
 * Sample data set.
 */
const data: TestData[] = [
  { id: '1', name: 'John Doe', email: 'john@example.com', status: 'Active' },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com', status: 'Pending' },
  { id: '3', name: 'Bob Wilson', email: 'bob@example.com', status: 'Active' },
];

const paginationPageOne: TestData[] = [
  ...data,
  {
    id: '4',
    name: 'Emily Davis',
    email: 'emily@example.com',
    status: 'Pending',
  },
  {
    id: '5',
    name: 'Frank Miller',
    email: 'frank@example.com',
    status: 'Active',
  },
  {
    id: '6',
    name: 'Grace Wilson',
    email: 'grace@example.com',
    status: 'Pending',
  },
  {
    id: '7',
    name: 'Henry Moore',
    email: 'henry@example.com',
    status: 'Active',
  },
  {
    id: '8',
    name: 'Ivy Taylor',
    email: 'ivy@example.com',
    status: 'Pending',
  },
  {
    id: '9',
    name: 'Jack Anderson',
    email: 'jack@example.com',
    status: 'Active',
  },
  {
    id: '10',
    name: 'Kate Thomas',
    email: 'kate@example.com',
    status: 'Pending',
  },
];

const paginationPageTwo: TestData[] = [
  {
    id: '11',
    name: 'Alex Brown',
    email: 'alex@example.com',
    status: 'Active',
  },
  {
    id: '12',
    name: 'Chris Davis',
    email: 'chris@example.com',
    status: 'Pending',
  },
  {
    id: '13',
    name: 'Morgan Lee',
    email: 'morgan@example.com',
    status: 'Active',
  },
  {
    id: '14',
    name: 'Nora Adams',
    email: 'nora@example.com',
    status: 'Pending',
  },
  {
    id: '15',
    name: 'Owen Clark',
    email: 'owen@example.com',
    status: 'Active',
  },
  {
    id: '16',
    name: 'Piper Evans',
    email: 'piper@example.com',
    status: 'Pending',
  },
  {
    id: '17',
    name: 'Quinn Foster',
    email: 'quinn@example.com',
    status: 'Active',
  },
  {
    id: '18',
    name: 'Riley Green',
    email: 'riley@example.com',
    status: 'Pending',
  },
  {
    id: '19',
    name: 'Sage Harris',
    email: 'sage@example.com',
    status: 'Active',
  },
  {
    id: '20',
    name: 'Taylor King',
    email: 'taylor@example.com',
    status: 'Pending',
  },
];

type DataTableEventSpies = {
  actionTriggered: Mock<(event: { actionId: string; row: TestData }) => void>;
  sortChanged: Mock<
    (event: { columnId: string; direction: 'asc' | 'desc' }) => void
  >;
  pageChanged: Mock<(page: number) => void>;
};

type DataTableStoryArgs = {
  data: TestData[];
  columns: TableColumnDef<TestData>[];
  actions: TableActionDef<TestData>[];
  loading: boolean;
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  sortColumnId: string | null;
  sortDirection: 'asc' | 'desc' | null;
} & Partial<DataTableEventSpies>;

const createEventSpies = (): DataTableEventSpies => ({
  actionTriggered: fn<(event: { actionId: string; row: TestData }) => void>(),
  sortChanged:
    fn<(event: { columnId: string; direction: 'asc' | 'desc' }) => void>(),
  pageChanged: fn<(page: number) => void>(),
});

const renderWithSpies =
  (spies: DataTableEventSpies) => (args: DataTableStoryArgs) => ({
    props: { ...args, ...spies },
    imports: [CommonModule],
    template: `
      <tai-data-table
        [data]="data"
        [columns]="columns"
        [actions]="actions"
        [loading]="loading"
        [totalCount]="totalCount"
        [pageIndex]="pageIndex"
        [pageSize]="pageSize"
        [sortColumnId]="sortColumnId"
        [sortDirection]="sortDirection"
        (actionTriggered)="actionTriggered($event)"
        (sortChanged)="sortChanged($event)"
        (pageChanged)="pageChanged($event)">
      </tai-data-table>
    `,
  });

const defaultSpies = createEventSpies();
const sortingSpies = createEventSpies();
const paginationSpies = createEventSpies();
const rowActionSpies = createEventSpies();

const renderSortingStory = (args: DataTableStoryArgs) => {
  const sortedData = signal(args.data);
  const sortColumnId = signal(args.sortColumnId);
  const sortDirection = signal(args.sortDirection);

  sortingSpies.sortChanged.mockImplementation((event) => {
    sortColumnId.set(event.columnId);
    sortDirection.set(event.direction);
    sortedData.set(
      [...args.data].sort((left, right) => {
        const comparison = left.name.localeCompare(right.name);
        return event.direction === 'asc' ? comparison : -comparison;
      }),
    );
  });

  return {
    props: {
      ...args,
      data: sortedData,
      sortColumnId,
      sortDirection,
      sortChanged: sortingSpies.sortChanged,
    },
    imports: [CommonModule],
    template: `
      <tai-data-table
        [data]="data()"
        [columns]="columns"
        [actions]="actions"
        [loading]="loading"
        [totalCount]="totalCount"
        [pageIndex]="pageIndex"
        [pageSize]="pageSize"
        [sortColumnId]="sortColumnId()"
        [sortDirection]="sortDirection()"
        (sortChanged)="sortChanged($event)">
      </tai-data-table>
    `,
  };
};

const renderPaginationStory = (args: DataTableStoryArgs) => {
  const pageRows = signal(args.data);
  const currentPage = signal(args.pageIndex);
  const pageData: TestData[][] = [args.data, paginationPageTwo];

  paginationSpies.pageChanged.mockImplementation((page) => {
    currentPage.set(page);
    pageRows.set(pageData[page - 1] ?? []);
  });

  return {
    props: {
      ...args,
      data: pageRows,
      pageIndex: currentPage,
      pageChanged: paginationSpies.pageChanged,
    },
    imports: [CommonModule],
    template: `
      <tai-data-table
        [data]="data()"
        [columns]="columns"
        [actions]="actions"
        [loading]="loading"
        [totalCount]="totalCount"
        [pageIndex]="pageIndex()"
        [pageSize]="pageSize"
        [sortColumnId]="sortColumnId"
        [sortDirection]="sortDirection"
        (pageChanged)="pageChanged($event)">
      </tai-data-table>
    `,
  };
};

/**
 * Storybook Configuration: DataTableComponent
 *
 * Audit Proof: This story demonstrates a robust, accessible DataTable component
 * capable of handling large datasets with server-side pagination, sorting,
 * and row actions. It strictly enforces a "dumb" presentation pattern,
 * delegating all business logic to its container via emitted events.
 */
const meta: Meta<DataTableStoryArgs> = {
  title: 'Organisms/DataTable',
  component: DataTableComponent,
  args: {
    data,
    columns,
    actions,
    totalCount: data.length,
    pageIndex: 1,
    pageSize: 10,
    loading: false,
    sortColumnId: null,
    sortDirection: null,
  },
  tags: ['autodocs'],
  render: renderWithSpies(defaultSpies),
};

export default meta;
type Story = StoryObj<DataTableStoryArgs>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('table')).toBeVisible();
    await expect(canvas.getAllByRole('columnheader')).toHaveLength(4);
    await expect(canvas.getAllByRole('row')).toHaveLength(4);
    await expect(canvas.getByText('John Doe')).toBeVisible();
    await expect(canvas.getByText('jane@example.com')).toBeVisible();
    await expect(
      canvas.getAllByRole('button', { name: 'Row actions' }),
    ).toHaveLength(3);
  },
};

/**
 * Loading State Audit:
 * Verifies that the table displays a consistent, non-distracting loading
 * overlay during server-side data fetching.
 */
export const Loading: Story = {
  args: {
    loading: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const overlay = canvas.getByTestId('table-loading');

    await expect(overlay).toBeVisible();
    await expect(canvas.getByText('Loading data...')).toBeVisible();
    await expect(canvas.getByRole('table')).toBeVisible();
  },
};

/**
 * Empty State Audit:
 * Verifies that the table provides a clear, actionable message when
 * no records match the current criteria.
 */
export const Empty: Story = {
  args: {
    data: [],
    totalCount: 0,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const emptyState = canvas.getByTestId('table-empty');

    await expect(emptyState).toBeVisible();
    await expect(
      canvas.getByRole('heading', { name: 'No records found' }),
    ).toBeVisible();
    await expect(
      canvas.getByText('Try adjusting your filters or search query.'),
    ).toBeVisible();
    await expect(canvas.queryAllByRole('row')).toHaveLength(1);
  },
};

export const Sorting: Story = {
  render: renderSortingStory,
  play: async ({ canvasElement }) => {
    sortingSpies.sortChanged.mockClear();

    const canvas = within(canvasElement);
    const nameSortButton = canvas.getByRole('button', { name: 'Sort by Name' });
    const statusSortButton = canvas.queryByRole('button', {
      name: 'Sort by Status',
    });

    await expect(nameSortButton).toBeVisible();
    await expect(statusSortButton).not.toBeInTheDocument();

    await userEvent.click(nameSortButton);
    await waitFor(() =>
      expect(canvas.getAllByTestId('cell-name')[0]).toHaveTextContent(
        'Bob Wilson',
      ),
    );
    await userEvent.click(nameSortButton);
    await waitFor(() =>
      expect(canvas.getAllByTestId('cell-name')[0]).toHaveTextContent(
        'John Doe',
      ),
    );
    await expect(sortingSpies.sortChanged).toHaveBeenNthCalledWith(1, {
      columnId: 'name',
      direction: 'asc',
    });
    await expect(sortingSpies.sortChanged).toHaveBeenNthCalledWith(2, {
      columnId: 'name',
      direction: 'desc',
    });
  },
};

export const Pagination: Story = {
  args: {
    data: paginationPageOne,
    totalCount: 25,
  },
  render: renderPaginationStory,
  play: async ({ canvasElement }) => {
    paginationSpies.pageChanged.mockClear();

    const canvas = within(canvasElement);
    const previousButton = canvas.getByRole('button', { name: 'Previous' });
    const nextButton = canvas.getByRole('button', { name: 'Next' });

    await expect(previousButton).toBeDisabled();
    await expect(nextButton).toBeEnabled();
    await expect(canvas.getByTestId('pagination-summary')).toHaveTextContent(
      'Showing 1 to 10 of 25 records',
    );
    await userEvent.click(nextButton);
    await expect(paginationSpies.pageChanged).toHaveBeenCalledWith(2);
    await waitFor(() =>
      expect(canvas.getByTestId('pagination-summary')).toHaveTextContent(
        'Showing 11 to 20 of 25 records',
      ),
    );
    await expect(canvas.getByText('Alex Brown')).toBeVisible();
    await expect(previousButton).toBeEnabled();
  },
};

export const RowActions: Story = {
  render: renderWithSpies(rowActionSpies),
  play: async ({ canvasElement }) => {
    rowActionSpies.actionTriggered.mockClear();

    const canvas = within(canvasElement);
    const rowActionMenus = canvas.getAllByRole('button', {
      name: 'Row actions',
    });
    await userEvent.click(rowActionMenus[0]);
    await waitFor(() => expect(canvas.getByRole('menu')).toBeVisible());
    await expect(canvas.getByRole('menuitem', { name: 'Edit' })).toBeVisible();
    await expect(
      canvas.queryByRole('menuitem', { name: 'Approve' }),
    ).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');

    await userEvent.click(rowActionMenus[1]);
    await waitFor(() => expect(canvas.getByRole('menu')).toBeVisible());
    await expect(
      canvas.getByRole('menuitem', { name: 'Approve' }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole('menuitem', { name: 'Approve' }));
    await expect(rowActionSpies.actionTriggered).toHaveBeenCalledWith({
      actionId: 'approve',
      row: data[1],
    });
  },
};
