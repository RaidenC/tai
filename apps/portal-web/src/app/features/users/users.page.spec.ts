import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UsersPage } from './users.page';
import { UsersStore } from './users.store';
import { signal } from '@angular/core';
import { Dialog, DialogModule } from '@angular/cdk/dialog';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { User } from './users.service';
import { CommonModule } from '@angular/common';
import { DataTableComponent } from '@tai/ui-design-system';

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

  it('should load users on init', () => {
    expect(mockStore.loadUsers).toHaveBeenCalled();
  });

  it('should call setPage when page is changed', () => {
    (component as any).onPageChange(2);
    expect(mockStore.setPage).toHaveBeenCalledWith(2);
  });

  it('should open confirmation dialog and approve user when confirmed', () => {
    const testUser: User = { 
      id: 'user-1', 
      name: 'John Doe', 
      email: 'john@example.com', 
      status: 'Pending', 
      rowVersion: 123 
    };
    
    mockDialog.open.mockReturnValue({
      closed: of(true)
    });

    (component as any).onAction({ actionId: 'approve', row: testUser });

    expect(mockDialog.open).toHaveBeenCalled();
    expect(mockStore.approveUser).toHaveBeenCalledWith('user-1', 123);
  });

  it('should NOT approve user when confirmation is cancelled', () => {
    const testUser: User = { 
      id: 'user-1', 
      name: 'John Doe', 
      email: 'john@example.com', 
      status: 'Pending', 
      rowVersion: 123 
    };
    
    mockDialog.open.mockReturnValue({
      closed: of(false)
    });

    (component as any).onAction({ actionId: 'approve', row: testUser });

    expect(mockDialog.open).toHaveBeenCalled();
    expect(mockStore.approveUser).not.toHaveBeenCalled();
  });

  it('should render the error message when store has an error', () => {
    mockStore.isError.set(true);
    (mockStore.errorMessage as any).set('API Error');
    fixture.detectChanges();

    const errorEl = fixture.nativeElement.querySelector('[role="alert"]');
    expect(errorEl).toBeTruthy();
    expect(errorEl.textContent).toContain('API Error');
  });
});
