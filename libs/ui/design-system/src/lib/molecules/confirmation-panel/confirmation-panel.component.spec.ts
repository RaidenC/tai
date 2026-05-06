import { ComponentFixture, TestBed } from '@angular/core/testing';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  ConfirmationPanelComponent,
  ConfirmationPanelData,
} from './confirmation-panel.component';

const baseData: ConfirmationPanelData = {
  title: 'Approve User Registration',
  message: 'Approve Jane Doe for access to the portal.',
  confirm: {
    label: 'Approve User',
    tone: 'default',
  },
  cancel: {
    label: 'Cancel',
  },
};

describe('ConfirmationPanelComponent', () => {
  let fixture: ComponentFixture<ConfirmationPanelComponent>;
  let component: ConfirmationPanelComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmationPanelComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmationPanelComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('data', baseData);
    fixture.detectChanges();
  });

  it('renders dialog semantics with labelled title and description', () => {
    const dialog = fixture.nativeElement.querySelector('[data-testid="confirmation-panel"]') as HTMLElement;
    const title = fixture.nativeElement.querySelector('[data-testid="modal-title"]') as HTMLElement;
    const message = fixture.nativeElement.querySelector('[data-testid="modal-message"]') as HTMLElement;

    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe(title.id);
    expect(dialog.getAttribute('aria-describedby')).toBe(message.id);
    expect(title.textContent?.trim()).toBe('Approve User Registration');
    expect(message.textContent?.trim()).toBe('Approve Jane Doe for access to the portal.');
  });

  it('renders preserved action test ids and labels', () => {
    const cancel = fixture.nativeElement.querySelector('[data-testid="modal-cancel-button"]') as HTMLButtonElement;
    const confirm = fixture.nativeElement.querySelector('[data-testid="modal-confirm-button"]') as HTMLButtonElement;

    expect(cancel.textContent?.trim()).toBe('Cancel');
    expect(confirm.textContent?.trim()).toBe('Approve User');
    expect(cancel.getAttribute('data-confirmation-focus')).toBe('cancel');
    expect(confirm.getAttribute('data-confirmation-focus')).toBe('confirm');
  });

  it('emits a typed confirm action once when enabled', () => {
    const spy = vi.fn();
    component.actionSelected.subscribe(spy);

    const confirm = fixture.nativeElement.querySelector('[data-testid="modal-confirm-button"]') as HTMLButtonElement;
    confirm.click();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ action: 'confirm' });
  });

  it('emits a typed cancel action once when enabled', () => {
    const spy = vi.fn();
    component.actionSelected.subscribe(spy);

    const cancel = fixture.nativeElement.querySelector('[data-testid="modal-cancel-button"]') as HTMLButtonElement;
    cancel.click();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ action: 'cancel' });
  });

  it('treats loading as higher priority than disabled and suppresses duplicate confirms', () => {
    const spy = vi.fn();
    component.actionSelected.subscribe(spy);
    fixture.componentRef.setInput('data', {
      ...baseData,
      confirm: {
        label: 'Approve User',
        tone: 'default',
        disabled: true,
        loading: true,
      },
    } satisfies ConfirmationPanelData);
    fixture.detectChanges();

    const confirm = fixture.nativeElement.querySelector('[data-testid="modal-confirm-button"]') as HTMLButtonElement;
    confirm.click();
    confirm.click();

    expect(confirm.disabled).toBe(true);
    expect(confirm.textContent).toContain('Working');
    expect(spy).not.toHaveBeenCalled();
  });

  it('disables cancel when cancel action is disabled', () => {
    fixture.componentRef.setInput('data', {
      ...baseData,
      cancel: {
        label: 'Cancel',
        disabled: true,
      },
    } satisfies ConfirmationPanelData);
    fixture.detectChanges();

    const cancel = fixture.nativeElement.querySelector('[data-testid="modal-cancel-button"]') as HTMLButtonElement;

    expect(cancel.disabled).toBe(true);
  });

  it('suppresses rapid duplicate confirm actions after the first click', () => {
    const spy = vi.fn();
    component.actionSelected.subscribe(spy);

    const confirm = fixture.nativeElement.querySelector('[data-testid="modal-confirm-button"]') as HTMLButtonElement;
    confirm.click();
    confirm.click();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('suppresses rapid duplicate cancel actions after the first click', () => {
    const spy = vi.fn();
    component.actionSelected.subscribe(spy);

    const cancel = fixture.nativeElement.querySelector('[data-testid="modal-cancel-button"]') as HTMLButtonElement;
    cancel.click();
    cancel.click();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('falls back empty labels and text to safe defaults', () => {
    fixture.componentRef.setInput('data', {
      title: '   ',
      message: '',
      confirm: { label: '   ' },
      cancel: { label: '' },
    } satisfies ConfirmationPanelData);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="modal-title"]').textContent.trim()).toBe('Confirm action');
    expect(fixture.nativeElement.querySelector('[data-testid="modal-message"]').textContent.trim()).toBe('Please review this action before continuing.');
    expect(fixture.nativeElement.querySelector('[data-testid="modal-confirm-button"]').textContent.trim()).toBe('Confirm');
    expect(fixture.nativeElement.querySelector('[data-testid="modal-cancel-button"]').textContent.trim()).toBe('Cancel');
  });

  it('clamps title and message length at the documented boundary', () => {
    const title = 'T'.repeat(121);
    const message = 'M'.repeat(501);
    fixture.componentRef.setInput('data', {
      ...baseData,
      title,
      message,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="modal-title"]').textContent.trim()).toHaveLength(120);
    expect(fixture.nativeElement.querySelector('[data-testid="modal-message"]').textContent.trim()).toHaveLength(500);

    fixture.componentRef.setInput('data', {
      ...baseData,
      title: 'T'.repeat(120),
      message: 'M'.repeat(500),
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="modal-title"]').textContent.trim()).toHaveLength(120);
    expect(fixture.nativeElement.querySelector('[data-testid="modal-message"]').textContent.trim()).toHaveLength(500);
  });

  it('renders untrusted text as text and not HTML', () => {
    fixture.componentRef.setInput('data', {
      ...baseData,
      title: '<img src=x onerror=alert(1)>Title',
      message: '<script>alert(1)</script>',
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="modal-title"]').textContent).toContain('<img src=x onerror=alert(1)>Title');
    expect(fixture.nativeElement.querySelector('[data-testid="modal-message"]').textContent).toContain('<script>alert(1)</script>');
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.querySelector('script')).toBeNull();
  });

  it('falls back invalid tone and initialFocus values to safe defaults', () => {
    fixture.componentRef.setInput('data', {
      ...baseData,
      confirm: {
        label: 'Approve User',
        tone: 'invalid' as never,
      },
      initialFocus: 'invalid' as never,
    });
    fixture.detectChanges();

    const confirm = fixture.nativeElement.querySelector('[data-testid="modal-confirm-button"]') as HTMLButtonElement;

    expect(confirm.classList.contains('bg-blue-600')).toBe(true);
    expect(component.initialFocusTarget()).toBe('confirm');
  });

  it('defaults initial focus to cancel for danger tone', () => {
    fixture.componentRef.setInput('data', {
      ...baseData,
      confirm: {
        label: 'Delete User',
        tone: 'danger',
      },
    });
    fixture.detectChanges();

    expect(component.initialFocusTarget()).toBe('cancel');
    expect(fixture.nativeElement.textContent).toContain('This action requires careful review.');
    expect(fixture.nativeElement.querySelector('[data-confirmation-focus="cancel"]')).toBeTruthy();
  });

  it('does not render inline style attributes', () => {
    expect(fixture.nativeElement.querySelector('[style]')).toBeNull();
  });

  it('does not import CDK dialog, overlay, focus, or Material primitives', () => {
    const componentPath = join(process.cwd(), 'libs/ui/design-system/src/lib/molecules/confirmation-panel/confirmation-panel.component.ts');
    const source = readFileSync(componentPath, 'utf8');

    expect(source).not.toContain('@angular/cdk/dialog');
    expect(source).not.toContain('@angular/cdk/overlay');
    expect(source).not.toContain('@angular/cdk/a11y');
    expect(source).not.toContain('@angular/material');
    expect(source).not.toContain('DialogRef');
    expect(source).not.toContain('DIALOG_DATA');
    expect(source).not.toContain('FocusTrap');
    expect(source).not.toContain('OverlayModule');
  });
});
