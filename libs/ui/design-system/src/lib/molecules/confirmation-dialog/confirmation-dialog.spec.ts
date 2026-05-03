import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import {
  ConfirmationDialogComponent,
  ConfirmationDialogData,
} from './confirmation-dialog';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ConfirmationDialogComponent compatibility wrapper', () => {
  let fixture: ComponentFixture<ConfirmationDialogComponent>;
  let mockDialogRef: { close: (result?: boolean) => void };

  const mockData: ConfirmationDialogData = {
    title: 'Approve User Registration',
    message: 'Approve Jane Doe for access to the portal.',
    confirmText: 'Approve User',
    cancelText: 'Cancel',
    confirmButtonClass: 'bg-indigo-600 hover:bg-indigo-700',
  };

  beforeEach(async () => {
    mockDialogRef = {
      close: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ConfirmationDialogComponent],
      providers: [
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: DIALOG_DATA, useValue: mockData },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmationDialogComponent);
    fixture.detectChanges();
  });

  it('renders the deprecated tai-confirmation-dialog wrapper through tai-confirmation-panel', () => {
    expect(fixture.nativeElement.querySelector('tai-confirmation-panel')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="modal-title"]').textContent.trim()).toBe('Approve User Registration');
    expect(fixture.nativeElement.querySelector('[data-testid="modal-message"]').textContent.trim()).toBe('Approve Jane Doe for access to the portal.');
  });

  it('maps legacy confirm and cancel labels', () => {
    expect(fixture.nativeElement.querySelector('[data-testid="modal-confirm-button"]').textContent.trim()).toBe('Approve User');
    expect(fixture.nativeElement.querySelector('[data-testid="modal-cancel-button"]').textContent.trim()).toBe('Cancel');
  });

  it('ignores legacy confirmButtonClass instead of applying caller classes', () => {
    const confirm = fixture.nativeElement.querySelector('[data-testid="modal-confirm-button"]') as HTMLButtonElement;

    expect(confirm.className).not.toContain('bg-indigo-600');
    expect(confirm.className).not.toContain('hover:bg-indigo-700');
    expect(confirm.className).toContain('bg-blue-600');
  });

  it('closes the legacy DialogRef with true on confirm', () => {
    const confirm = fixture.nativeElement.querySelector('[data-testid="modal-confirm-button"]') as HTMLButtonElement;
    confirm.click();

    expect(mockDialogRef.close).toHaveBeenCalledWith(true);
  });

  it('closes the legacy DialogRef with false on cancel', () => {
    const cancel = fixture.nativeElement.querySelector('[data-testid="modal-cancel-button"]') as HTMLButtonElement;
    cancel.click();

    expect(mockDialogRef.close).toHaveBeenCalledWith(false);
  });
});
