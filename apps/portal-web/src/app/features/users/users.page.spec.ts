import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UsersPage } from './users.page';
import { OnboardingStore } from '../onboarding/onboarding.store';
import { signal, WritableSignal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { PendingUser } from '../onboarding/onboarding.service';

describe('UsersPage', () => {
  let component: UsersPage;
  let fixture: ComponentFixture<UsersPage>;
  let mockStore: {
    allUsers: WritableSignal<PendingUser[]>;
    isLoading: WritableSignal<boolean>;
    isError: WritableSignal<boolean>;
    errorMessage: WritableSignal<string>;
    loadUsers: Mock;
  };

  beforeEach(async () => {
    mockStore = {
      allUsers: signal([]),
      isLoading: signal(false),
      isError: signal(false),
      errorMessage: signal(''),
      loadUsers: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [UsersPage],
      providers: [
        { provide: OnboardingStore, useValue: mockStore }
      ]
    }).compileComponents();

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

  it('should show loading spinner when store is loading', () => {
    mockStore.isLoading.set(true);
    fixture.detectChanges();

    const spinner = fixture.debugElement.query(By.css('.animate-spin'));
    expect(spinner).toBeTruthy();
  });

  it('should render user list when users are present', () => {
    const users: PendingUser[] = [
      { id: '1', name: 'User 1', email: 'user1@tai.com', status: 'Active' },
      { id: '2', name: 'User 2', email: 'user2@tai.com', status: 'Pending' }
    ];
    mockStore.allUsers.set(users);
    fixture.detectChanges();

    const rows = fixture.debugElement.queryAll(By.css('tbody tr'));
    expect(rows.length).toBe(2);
    expect(rows[0].nativeElement.textContent).toContain('User 1');
    expect(rows[1].nativeElement.textContent).toContain('User 2');
  });

  it('should show empty message when no users are present', () => {
    mockStore.allUsers.set([]);
    fixture.detectChanges();

    const emptyCell = fixture.debugElement.query(By.css('td[colspan="2"]'));
    expect(emptyCell.nativeElement.textContent).toContain('No users found');
  });

  it('should show error message when store has error', () => {
    mockStore.isError.set(true);
    mockStore.errorMessage.set('Fetch failed');
    fixture.detectChanges();

    const errorDiv = fixture.debugElement.query(By.css('.text-red-700'));
    expect(errorDiv.nativeElement.textContent).toContain('Fetch failed');
  });
});
