import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import {
  ConfirmationDialogComponent,
  ConfirmationDialogData,
} from './confirmation-dialog';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * ConfirmationDialogComponent Unit Tests
 *
 * Verifies that the dialog correctly renders content from the provided data
 * and emits the appropriate signals to the DialogRef when actions are triggered.
 */
describe('ConfirmationDialogComponent', () => {
  let component: ConfirmationDialogComponent;
  let fixture: ComponentFixture<ConfirmationDialogComponent>;
  let mockDialogRef: { close: (result?: boolean) => void };

  const mockData: ConfirmationDialogData = {
    title: 'Test Confirmation',
    message: 'Are you sure you want to proceed?',
    confirmText: 'Yes, Proceed',
    cancelText: 'No, Stop',
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
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the provided title and message', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const title = compiled.querySelector('[data-testid="modal-title"]');
    const message = compiled.querySelector('[data-testid="modal-message"]');

    expect(title?.textContent?.trim()).toBe(mockData.title);
    expect(message?.textContent?.trim()).toBe(mockData.message);
  });

  it('should render custom button labels', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const confirmBtn = compiled.querySelector(
      '[data-testid="modal-confirm-button"]',
    );
    const cancelBtn = compiled.querySelector(
      '[data-testid="modal-cancel-button"]',
    );

    expect(confirmBtn?.textContent?.trim()).toBe(mockData.confirmText);
    expect(cancelBtn?.textContent?.trim()).toBe(mockData.cancelText);
  });

  it('should call dialogRef.close(true) when confirm button is clicked', () => {
    const confirmBtn = fixture.nativeElement.querySelector(
      '[data-testid="modal-confirm-button"]',
    ) as HTMLButtonElement;
    confirmBtn.click();
    expect(mockDialogRef.close).toHaveBeenCalledWith(true);
  });

  it('should call dialogRef.close(false) when cancel button is clicked', () => {
    const cancelBtn = fixture.nativeElement.querySelector(
      '[data-testid="modal-cancel-button"]',
    ) as HTMLButtonElement;
    cancelBtn.click();
    expect(mockDialogRef.close).toHaveBeenCalledWith(false);
  });

  it('should apply custom button class to confirm button', async () => {
    // Reconfigure for custom class test
    TestBed.resetTestingModule();
    const customClass = 'bg-red-600';
    await TestBed.configureTestingModule({
      imports: [ConfirmationDialogComponent],
      providers: [
        { provide: DialogRef, useValue: mockDialogRef },
        {
          provide: DIALOG_DATA,
          useValue: { ...mockData, confirmButtonClass: customClass },
        },
      ],
    }).compileComponents();

    const customFixture = TestBed.createComponent(ConfirmationDialogComponent);
    customFixture.detectChanges();
    const confirmBtn = customFixture.nativeElement.querySelector(
      '[data-testid="modal-confirm-button"]',
    );
    expect(confirmBtn.classList.contains(customClass)).toBe(true);
  });
});
