import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataTableComponent, TableColumnDef, TableActionDef } from './data-table';
import { CdkTableModule } from '@angular/cdk/table';
import { CdkMenuModule } from '@angular/cdk/menu';
import { describe, it, expect, beforeEach, vi } from 'vitest';

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
    { id: 'status', header: 'Status', cell: (row) => row.status }
  ];

  const actions: TableActionDef<TestData>[] = [
    { id: 'edit', label: 'Edit' },
    { id: 'approve', label: 'Approve', visible: (row) => row.status === 'Pending' }
  ];

  const data: TestData[] = [
    { id: '1', name: 'John Doe', status: 'Active' },
    { id: '2', name: 'Jane Smith', status: 'Pending' }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataTableComponent, CdkTableModule, CdkMenuModule],
    }).compileComponents();

    fixture = TestBed.createComponent(DataTableComponent<TestData>);
    component = fixture.componentInstance;
    
    fixture.componentRef.setInput('data', data);
    fixture.componentRef.setInput('columns', columns);
    fixture.componentRef.setInput('actions', actions);
    fixture.componentRef.setInput('totalCount', data.length);
    
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the correct number of headers and data rows', () => {
    const headers = fixture.nativeElement.querySelectorAll('th');
    const rows = fixture.nativeElement.querySelectorAll('tr[cdk-row]');
    
    // 2 data columns + 1 actions column = 3
    expect(headers.length).toBe(3);
    expect(rows.length).toBe(2);
  });

  it('should render the action menu triggers for each row', () => {
    const triggers = fixture.nativeElement.querySelectorAll('[data-testid^="action-menu-trigger-"]');
    expect(triggers.length).toBe(2);
  });

  it('should emit actionTriggered when onAction is called', () => {
    const spy = vi.fn();
    component.actionTriggered.subscribe(spy);
    
    component.onAction('edit', data[0]);
    
    expect(spy).toHaveBeenCalledWith({ actionId: 'edit', row: data[0] });
  });

  it('should correctly determine action visibility based on row data', () => {
    const approveAction = actions.find(a => a.id === 'approve')!;
    
    expect(component.isActionVisible(approveAction, data[0])).toBe(false); // Active
    expect(component.isActionVisible(approveAction, data[1])).toBe(true);  // Pending
  });

  it('should emit sortChanged with correct parameters when a header is clicked', () => {
    const spy = vi.fn();
    component.sortChanged.subscribe(spy);
    
    const nameSortBtn = fixture.nativeElement.querySelector('[data-testid="sort-button-name"]') as HTMLElement;
    
    // First click: asc
    nameSortBtn.click();
    expect(spy).toHaveBeenCalledWith({ columnId: 'name', direction: 'asc' });

    // Second click: desc
    nameSortBtn.click();
    expect(spy).toHaveBeenCalledWith({ columnId: 'name', direction: 'desc' });
  });

  it('should NOT render a sort button when a column is not sortable', () => {
    const statusSortBtn = fixture.nativeElement.querySelector('[data-testid="sort-button-status"]');
    expect(statusSortBtn).toBeFalsy();
  });

  it('should render the correct pagination summary text', () => {
    fixture.componentRef.setInput('totalCount', 25);
    fixture.componentRef.setInput('pageIndex', 2); // Page 2 of 10-per-page
    fixture.componentRef.setInput('pageSize', 10);
    fixture.detectChanges();
    
    const summary = fixture.nativeElement.querySelector('[data-testid="pagination-summary"]').textContent;
    expect(summary).toContain('Showing 11 to 20 of 25 records');
  });

  it('should disable the Previous button on the first page', () => {
    fixture.componentRef.setInput('pageIndex', 1);
    fixture.detectChanges();
    
    const prevBtn = fixture.nativeElement.querySelector('[data-testid="pagination-prev"]') as HTMLButtonElement;
    expect(prevBtn.disabled).toBe(true);
  });

  it('should disable the Next button on the last page', () => {
    fixture.componentRef.setInput('totalCount', 15);
    fixture.componentRef.setInput('pageIndex', 2);
    fixture.componentRef.setInput('pageSize', 10);
    fixture.detectChanges();
    
    const nextBtn = fixture.nativeElement.querySelector('[data-testid="pagination-next"]') as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);
  });

  it('should render the loading overlay when loading input is true', () => {
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    
    const loadingOverlay = fixture.nativeElement.querySelector('[data-testid="table-loading"]');
    expect(loadingOverlay).toBeTruthy();
  });

  it('should render the empty state UI when data is empty and not loading', () => {
    fixture.componentRef.setInput('data', []);
    fixture.componentRef.setInput('totalCount', 0);
    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();
    
    const emptyState = fixture.nativeElement.querySelector('[data-testid="table-empty"]');
    expect(emptyState).toBeTruthy();
    expect(emptyState.textContent).toContain('No records found');
  });

  it('should handle pagination triggers correctly', () => {
    const spy = vi.fn();
    component.pageChanged.subscribe(spy);
    
    fixture.componentRef.setInput('totalCount', 20);
    fixture.componentRef.setInput('pageIndex', 1);
    fixture.detectChanges();
    
    const nextBtn = fixture.nativeElement.querySelector('[data-testid="pagination-next"]') as HTMLButtonElement;
    nextBtn.click();
    
    expect(spy).toHaveBeenCalledWith(2);
  });
});
