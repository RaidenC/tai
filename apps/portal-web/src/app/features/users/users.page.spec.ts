import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UsersPage } from './users.page';
import { UsersStore } from './users.store';
import { signal } from '@angular/core';
import { Dialog, DialogModule } from '@angular/cdk/dialog';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { User } from './users.service';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';

describe('UsersPage', () => {
  let component: UsersPage;
  let fixture: ComponentFixture<UsersPage>;
  let mockStore: any;
  let mockDialog: any;
  let mockRouter: any;

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

    mockRouter = {
      navigate: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [UsersPage],
    })
    .overrideComponent(UsersPage, {
      remove: { imports: [DialogModule] },
      add: { providers: [
        { provide: UsersStore, useValue: mockStore },
        { provide: Dialog, useValue: mockDialog },
        { provide: Router, useValue: mockRouter }
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

  it('should trigger approval flow when approve action is clicked', () => {
    const testUser: User = { 
      id: 'user-1', 
      firstName: 'John', 
      lastName: 'Doe', 
      email: 'john@example.com', 
      status: 'PendingApproval', 
      rowVersion: 123 
    };
    
    // Explicitly call the handler that would be triggered by (actionTriggered)
    component['onAction']({ actionId: 'approve', row: testUser });

    expect(mockDialog.open).toHaveBeenCalled();
    expect(mockStore.approveUser).toHaveBeenCalledWith('user-1', 123);
  });

  it('should navigate to details on view action', () => {
    const testUser: User = { 
      id: 'user-1', 
      firstName: 'John', 
      lastName: 'Doe', 
      email: 'john@example.com', 
      status: 'Active', 
      rowVersion: 123 
    };
    
    component['onAction']({ actionId: 'view', row: testUser });

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/users', 'user-1'], { queryParams: {} });
  });

  it('should navigate to details with edit param on edit action', () => {
    const testUser: User = { 
      id: 'user-1', 
      firstName: 'John', 
      lastName: 'Doe', 
      email: 'john@example.com', 
      status: 'Active', 
      rowVersion: 123 
    };
    
    component['onAction']({ actionId: 'edit', row: testUser });

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/users', 'user-1'], { queryParams: { edit: 'true' } });
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
    expect(component['actions'].length).toBe(3);
    
    const approveAction = component['actions'].find(a => a.id === 'approve');
    const activeUser = { status: 'Active' } as User;
    const pendingUser = { status: 'PendingApproval' } as User;
    
    expect(approveAction?.visible?.(activeUser)).toBe(false);
    expect(approveAction?.visible?.(pendingUser)).toBe(true);

    const nameColumn = component['columns'].find(c => c.id === 'name');
    expect(nameColumn?.cell({ firstName: 'A', lastName: 'B' } as any)).toBe('A B');
  });

  it('should pass loading state to data table', () => {
    mockStore.isLoading.set(true);
    fixture.detectChanges();
    
    const table = fixture.debugElement.query(By.css('tai-data-table'));
    expect(table.componentInstance.loading()).toBe(true);
  });

  it('should pass users data to data table', () => {
    const users: User[] = [{ id: '1', firstName: 'T', lastName: 'E', email: 'test@tai.com', status: 'Active', rowVersion: 1 }];
    mockStore.users.set(users);
    fixture.detectChanges();
    
    const table = fixture.debugElement.query(By.css('tai-data-table'));
    expect(table.componentInstance.data()).toEqual(users);
  });
});
