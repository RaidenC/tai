import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CdkTableModule } from '@angular/cdk/table';
import { DataTableComponent, TableColumnDef, TableActionDef } from './data-table';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * DataTableComponent Unit Tests
 * 
 * Persona: Quality Architect.
 * Focus: Verifies that the headless DataTable correctly orchestrates 
 * structural rendering, conditional row actions, and state-driven UI 
 * (loading/empty states) while strictly adhering to the "dumb" component pattern.
 */
interface TestData {
  id: string;
  name: string;
  status: 'Active' | 'Pending';
}

describe('DataTableComponent', () => {
  let component: DataTableComponent<TestData>;
  let fixture: ComponentFixture<DataTableComponent<TestData>>;

  const columns: TableColumnDef<TestData>[] = [
    { id: 'name', header: 'Name', cell: row => row.name, sortable: true },
    { id: 'status', header: 'Status', cell: row => row.status }
  ];

  const actions: TableActionDef<TestData>[] = [
    { id: 'approve', label: 'Approve', visible: row => row.status === 'Pending' },
    { id: 'edit', label: 'Edit' }
  ];

  const data: TestData[] = [
    { id: '1', name: 'John', status: 'Active' },
    { id: '2', name: 'Jane', status: 'Pending' }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataTableComponent, CdkTableModule],
    }).compileComponents();

    fixture = TestBed.createComponent(DataTableComponent<TestData>);
    component = fixture.componentInstance;
    
    // Set required inputs via the componentRef for signal inputs
    fixture.componentRef.setInput('data', data);
    fixture.componentRef.setInput('columns', columns);
    fixture.componentRef.setInput('actions', actions);
    fixture.componentRef.setInput('totalCount', 2);
    
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the correct number of headers and data rows', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="header-name"]')).toBeTruthy();
    expect(compiled.querySelector('[data-testid="header-status"]')).toBeTruthy();
    expect(compiled.querySelectorAll('[cdk-row]')).toHaveLength(2);
  });

  it('should emit actionTriggered when an action button is clicked', () => {
    const spy = vi.fn();
    component.actionTriggered.subscribe(spy);
    
    // Use data-testid for precise targeting
    const editBtn = fixture.nativeElement.querySelector('[data-testid="action-edit"]') as HTMLButtonElement;
    editBtn.click();
    
    expect(spy).toHaveBeenCalledWith({ actionId: 'edit', row: data[0] });
  });

  it('should enforce conditional action visibility based on row data', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const rows = compiled.querySelectorAll('[cdk-row]');
    
    // Row 1 (Active) - 'Approve' action should be absent
    expect(rows[0].querySelector('[data-testid="action-approve"]')).toBeFalsy();
    
    // Row 2 (Pending) - 'Approve' action should be present
    expect(rows[1].querySelector('[data-testid="action-approve"]')).toBeTruthy();
  });

  it('should emit sortChanged with correct parameters when a header is clicked', () => {
    const spy = vi.fn();
    component.sortChanged.subscribe(spy);
    
    const nameHeader = fixture.nativeElement.querySelector('[data-testid="header-name"]') as HTMLElement;
    
    // First click: asc
    nameHeader.click();
    expect(spy).toHaveBeenCalledWith({ columnId: 'name', direction: 'asc' });

    // Second click: desc
    nameHeader.click();
    expect(spy).toHaveBeenCalledWith({ columnId: 'name', direction: 'desc' });
  });

  it('should render the loading overlay when loading input is true', () => {
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    
    const loadingOverlay = fixture.nativeElement.querySelector('[data-testid="table-loading"]');
    expect(loadingOverlay).toBeTruthy();
    expect(loadingOverlay.textContent).toContain('Loading data...');
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
    
    // Simulate being on page 1 with more items available
    fixture.componentRef.setInput('totalCount', 25);
    fixture.componentRef.setInput('pageIndex', 1);
    fixture.componentRef.setInput('pageSize', 10);
    fixture.detectChanges();

    const nextBtn = fixture.nativeElement.querySelector('[data-testid="pagination-next"]') as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(false);
    
    nextBtn.click();
    expect(spy).toHaveBeenCalledWith(2);
  });
});
