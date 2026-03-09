import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApprovalsPage } from './approvals.page';
import { OnboardingStore } from '../onboarding.store';
import { signal, WritableSignal } from '@angular/core';
import { PendingApprovalsTileComponent, PendingUser } from '@tai/ui-design-system';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';

describe('ApprovalsPage', () => {
  let component: ApprovalsPage;
  let fixture: ComponentFixture<ApprovalsPage>;
  let mockStore: {
    pendingUsers: WritableSignal<PendingUser[]>;
    isError: WritableSignal<boolean>;
    errorMessage: WritableSignal<string>;
    loadPendingApprovals: Mock;
    approve: Mock;
  };

  beforeEach(async () => {
    mockStore = {
      pendingUsers: signal([]),
      isError: signal(false),
      errorMessage: signal(''),
      loadPendingApprovals: vi.fn(),
      approve: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [ApprovalsPage, PendingApprovalsTileComponent],
      providers: [
        { provide: OnboardingStore, useValue: mockStore }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ApprovalsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load pending approvals on init', () => {
    expect(mockStore.loadPendingApprovals).toHaveBeenCalled();
  });

  it('should pass pending users to tile component', () => {
    const users: PendingUser[] = [{ id: '1', email: 'user@tai.com', name: 'User' }];
    mockStore.pendingUsers.set(users);
    fixture.detectChanges();

    const tile = fixture.debugElement.query(By.directive(PendingApprovalsTileComponent)).componentInstance as PendingApprovalsTileComponent;
    expect(tile.users()).toEqual(users);
  });

  it('should call store.approve when tile emits approved', () => {
    const userId = 'user-123';
    const tile = fixture.debugElement.query(By.directive(PendingApprovalsTileComponent)).componentInstance as PendingApprovalsTileComponent;
    
    tile.approved.emit(userId);
    
    expect(mockStore.approve).toHaveBeenCalledWith(userId);
  });

  it('should show error message when store has error', () => {
    mockStore.isError.set(true);
    mockStore.errorMessage.set('Load failed');
    fixture.detectChanges();

    const errorDiv = fixture.debugElement.query(By.css('.text-red-700'));
    expect(errorDiv.nativeElement.textContent).toContain('Load failed');
  });
});
