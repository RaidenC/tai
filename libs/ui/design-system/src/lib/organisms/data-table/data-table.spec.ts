import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  DataTableComponent,
  TableColumnDef,
  TableActionDef,
} from './data-table';
import { describe, it, expect, beforeEach } from 'vitest';

interface TestData {
  id: string;
  name: string;
  status: string;
}

describe('DataTableComponent', () => {
  let component: DataTableComponent<TestData>;
  let fixture: ComponentFixture<DataTableComponent<TestData>>;

  const columns: TableColumnDef<TestData>[] = [
    { id: 'name', header: 'Name', cell: (row) => row.name, sortable: true },
    { id: 'status', header: 'Status', cell: (row) => row.status },
  ];

  const actions: TableActionDef<TestData>[] = [
    { id: 'edit', label: 'Edit' },
    {
      id: 'approve',
      label: 'Approve',
      visible: (row) => row.status === 'Pending',
    },
  ];

  const data: TestData[] = [
    { id: '1', name: 'John Doe', status: 'Active' },
    { id: '2', name: 'Jane Smith', status: 'Pending' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataTableComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DataTableComponent<TestData>);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('data', data);
    fixture.componentRef.setInput('columns', columns);
    fixture.componentRef.setInput('actions', actions);
    fixture.componentRef.setInput('totalCount', data.length);

    fixture.detectChanges();
  });

  it('should correctly determine action visibility based on row data', () => {
    const approveAction = actions.find((a) => a.id === 'approve');
    if (!approveAction) throw new Error('approve action not found');

    expect(component.isActionVisible(approveAction, data[0])).toBe(false); // Active
    expect(component.isActionVisible(approveAction, data[1])).toBe(true); // Pending
  });

  it('computes displayed columns and pagination summary', () => {
    expect(component.displayedColumns()).toEqual(['name', 'status', 'actions']);

    fixture.componentRef.setInput('totalCount', 25);
    fixture.componentRef.setInput('pageIndex', 2);
    fixture.componentRef.setInput('pageSize', 10);
    fixture.detectChanges();

    expect(component.paginationSummary()).toEqual({
      start: 11,
      end: 20,
      total: 25,
    });
  });

  it('returns visible row actions and maps them to dropdown items', () => {
    expect(component.visibleActionsFor(data[0])).toEqual([actions[0]]);
    expect(component.visibleActionsFor(data[1])).toEqual(actions);
    expect(component.dropdownItemsFor(data[1])).toEqual([
      { id: 'edit', label: 'Edit' },
      { id: 'approve', label: 'Approve' },
    ]);
  });

  it('returns stable row action identifiers', () => {
    expect(component.rowActionId(data[0])).toBe('1');
    expect(component.rowActionId({ Id: 42 } as unknown as TestData)).toBe('42');
    expect(
      component.rowActionId({ name: 'No ID' } as unknown as TestData),
    ).toBe('row');
  });
});
