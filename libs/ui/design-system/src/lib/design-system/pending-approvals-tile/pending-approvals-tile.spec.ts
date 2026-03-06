import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PendingApprovalsTileComponent } from './pending-approvals-tile';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('PendingApprovalsTileComponent', () => {
  let component: PendingApprovalsTileComponent;
  let fixture: ComponentFixture<PendingApprovalsTileComponent>;

  const mockUsers = [
    { id: '1', email: 'user1@example.com', name: 'User One' },
    { id: '2', email: 'user2@example.com', name: 'User Two' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PendingApprovalsTileComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PendingApprovalsTileComponent);
    component = fixture.componentInstance;
    // Set mock data via input
    fixture.componentRef.setInput('users', mockUsers);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the list of pending users', () => {
    const rows = fixture.debugElement.queryAll(By.css('.user-row'));
    expect(rows.length).toBe(mockUsers.length);
    expect(rows[0].nativeElement.textContent).toContain(mockUsers[0].email);
    expect(rows[1].nativeElement.textContent).toContain(mockUsers[1].email);
  });

  it('should emit the approved event with user ID when Approve is clicked', () => {
    const approveSpy = vi.fn();
    component.approved.subscribe(approveSpy);

    const approveButtons = fixture.debugElement.queryAll(By.css('.approve-button'));
    approveButtons[0].nativeElement.click();

    expect(approveSpy).toHaveBeenCalledWith(mockUsers[0].id);
  });
});
