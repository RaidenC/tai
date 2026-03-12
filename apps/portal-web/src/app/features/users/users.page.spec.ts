import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UsersPage } from './users.page';
import { UsersStore } from './users.store';
import { signal } from '@angular/core';
import { Dialog, DialogModule } from '@angular/cdk/dialog';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { User } from './users.service';
import { By } from '@angular/platform-browser';

describe('UsersPage', () => {
  let component: UsersPage;
  let fixture: ComponentFixture<UsersPage>;
  let mockStore: any;
  let mockDialog: any;

  beforeEach(async () => {
    mockStore = {
      users: signal<User[]>([]),
      totalCount: signal(0),
      pageIndex: signal(1),
      pageSize: signal(10),
      isLoading: signal(false),
      isError: signal(false),
      errorMessage: signal(null),
      loadUsers: vi.fn(),
      setPage: vi.fn(),
      approveUser: vi.fn(),
    };

    mockDialog = {
      open: vi.fn().mockReturnValue({
        closed: of(true)
      }),
    };

    await TestBed.configureTestingModule({
      imports: [UsersPage],
    })
    .overrideComponent(UsersPage, {
      remove: { imports: [DialogModule] },
      add: { providers: [
        { provide: UsersStore, useValue: mockStore },
        { provide: Dialog, useValue: mockDialog }
      ]}
    })
    .compileComponents();

    fixture = TestBed.createComponent(UsersPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render page title and subtitle', () => {
    const h1 = fixture.nativeElement.querySelector('h1');
    const p = fixture.nativeElement.querySelector('header p');
    expect(h1.textContent).toBe('Users Directory');
    expect(p.textContent).toBe('Manage tenant users and approve pending registrations.');
  });

  it('should call setPage when onPageChange is triggered', () => {
    component['onPageChange'](3);
    expect(mockStore.setPage).toHaveBeenCalledWith(3);
  });

  it('should log to console when sort is changed', () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const sort = { columnId: 'name', direction: 'asc' as const };
    component['onSortChange'](sort);
    expect(consoleSpy).toHaveBeenCalledWith('Sort changed:', sort);
  });

  it('should trigger approval flow when approve action is clicked', () => {
    const testUser: User = { 
      id: 'user-1', 
      name: 'John Doe', 
      email: 'john@example.com', 
      status: 'Pending', 
      rowVersion: 123 
    };
    
    // Explicitly call the handler that would be triggered by (actionTriggered)
    component['onAction']({ actionId: 'approve', row: testUser });

    expect(mockDialog.open).toHaveBeenCalled();
    expect(mockStore.approveUser).toHaveBeenCalledWith('user-1', 123);
  });

  it('should NOT trigger approval for non-approve actions', () => {
    const testUser: User = { 
      id: 'user-1', 
      name: 'John Doe', 
      email: 'john@example.com', 
      status: 'Active', 
      rowVersion: 123 
    };
    
    component['onAction']({ actionId: 'edit', row: testUser });

    expect(mockDialog.open).not.toHaveBeenCalled();
    expect(mockStore.approveUser).not.toHaveBeenCalled();
  });

  it('should render error alert when store has an error', () => {
    mockStore.isError.set(true);
    (mockStore.errorMessage as any).set('Critical Failure');
    fixture.detectChanges();

    const errorAlert = fixture.debugElement.query(By.css('[role="alert"]'));
    expect(errorAlert).toBeTruthy();
    expect(errorAlert.nativeElement.textContent).toContain('Critical Failure');
  });

  it('should define columns and actions correctly', () => {
    expect(component['columns'].length).toBe(3);
    expect(component['actions'].length).toBe(2);
    
    const approveAction = component['actions'].find(a => a.id === 'approve');
    const activeUser = { status: 'Active' } as User;
    const pendingUser = { status: 'Pending' } as User;
    
    expect(approveAction?.visible?.(activeUser)).toBe(false);
    expect(approveAction?.visible?.(pendingUser)).toBe(true);

    const nameColumn = component['columns'].find(c => c.id === 'name');
    expect(nameColumn?.cell(activeUser)).toBe(activeUser.name);

    const emailColumn = component['columns'].find(c => c.id === 'email');
    expect(emailColumn?.cell(activeUser)).toBe(activeUser.email);

    const statusColumn = component['columns'].find(c => c.id === 'status');
    expect(statusColumn?.cell(activeUser)).toBe(activeUser.status);

    const editAction = component['actions'].find(a => a.id === 'edit');
    expect(editAction?.visible?.(activeUser)).not.toBe(false); // Should be true by default (undefined visible)
  });

  it('should pass loading state to data table', () => {
    mockStore.isLoading.set(true);
    fixture.detectChanges();
    
    const table = fixture.debugElement.query(By.css('tai-data-table'));
    expect(table.componentInstance.loading()).toBe(true);
  });

  it('should pass users data to data table', () => {
    const users: User[] = [{ id: '1', name: 'Test', email: 'test@tai.com', status: 'Active', rowVersion: 1 }];
    mockStore.users.set(users);
    fixture.detectChanges();
    
    const table = fixture.debugElement.query(By.css('tai-data-table'));
    expect(table.componentInstance.data()).toEqual(users);
  });
});
