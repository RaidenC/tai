import { ComponentFixture, TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, beforeEach } from 'vitest';
import { UsersConfirmationHostComponent } from './users-confirmation-host.component';
import { User } from './users.service';
import { ConfirmationPanelData } from '@tai/ui-design-system';

const pendingUser: User = {
  id: 'user-1',
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  status: 'PendingApproval',
  rowVersion: 42,
};

describe('UsersConfirmationHostComponent', () => {
  let fixture: ComponentFixture<UsersConfirmationHostComponent>;
  let component: UsersConfirmationHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UsersConfirmationHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(UsersConfirmationHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('opens with approval content and default focus on confirm', async () => {
    const promise = component.confirmApproval(pendingUser);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="modal-title"]').textContent).toContain('Approve User Registration');
    expect(fixture.nativeElement.querySelector('[data-testid="modal-message"]').textContent).toContain('jane@example.com');
    expect(component.isOpen()).toBe(true);
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('[data-testid="modal-confirm-button"]'));

    component.handlePanelAction({ action: 'cancel' });
    await expect(promise).resolves.toBe(false);
  });

  it('opens generic danger confirmation without explicit initialFocus on cancel', async () => {
    const dangerData: ConfirmationPanelData = {
      title: 'Delete User Account',
      message: 'This action cannot be undone.',
      confirm: {
        label: 'Delete Account',
        tone: 'danger',
      },
      cancel: {
        label: 'Keep Account',
      },
    };

    const promise = component.openConfirmation(dangerData);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[data-testid="modal-title"]').textContent).toContain('Delete User Account');
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('[data-testid="modal-cancel-button"]'));

    component.handlePanelAction({ action: 'cancel' });
    await expect(promise).resolves.toBe(false);
  });

  it('honors explicit initialFocus override for generic confirmations', async () => {
    const dangerData: ConfirmationPanelData = {
      title: 'Delete User Account',
      message: 'This action cannot be undone.',
      confirm: {
        label: 'Delete Account',
        tone: 'danger',
      },
      cancel: {
        label: 'Keep Account',
      },
      initialFocus: 'confirm',
    };

    const promise = component.openConfirmation(dangerData);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('[data-testid="modal-confirm-button"]'));

    component.handlePanelAction({ action: 'cancel' });
    await expect(promise).resolves.toBe(false);
  });

  it('maps confirm action to true and cancel action to false', async () => {
    const confirmPromise = component.confirmApproval(pendingUser);
    fixture.detectChanges();
    component.handlePanelAction({ action: 'confirm' });
    await expect(confirmPromise).resolves.toBe(true);

    const cancelPromise = component.confirmApproval(pendingUser);
    fixture.detectChanges();
    component.handlePanelAction({ action: 'cancel' });
    await expect(cancelPromise).resolves.toBe(false);
  });

  it('maps Escape and backdrop click to false', async () => {
    const escapePromise = component.confirmApproval(pendingUser);
    fixture.detectChanges();
    component.onKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
    await expect(escapePromise).resolves.toBe(false);

    const backdropPromise = component.confirmApproval(pendingUser);
    fixture.detectChanges();
    const backdrop = fixture.nativeElement.querySelector('[data-testid="users-confirmation-backdrop"]') as HTMLElement;
    backdrop.click();
    await expect(backdropPromise).resolves.toBe(false);
  });

  it('loops Tab and Shift+Tab focus inside the host', async () => {
    const promise = component.confirmApproval(pendingUser);
    fixture.detectChanges();
    await fixture.whenStable();

    const cancel = fixture.nativeElement.querySelector('[data-testid="modal-cancel-button"]') as HTMLButtonElement;
    const confirm = fixture.nativeElement.querySelector('[data-testid="modal-confirm-button"]') as HTMLButtonElement;

    confirm.focus();
    component.onKeydown(new KeyboardEvent('keydown', { key: 'Tab' }));
    expect(document.activeElement).toBe(cancel);

    cancel.focus();
    component.onKeydown(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }));
    expect(document.activeElement).toBe(confirm);

    component.handlePanelAction({ action: 'cancel' });
    await expect(promise).resolves.toBe(false);
  });

  it('restores focus to opener after close', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const promise = component.confirmApproval(pendingUser);
    fixture.detectChanges();
    component.handlePanelAction({ action: 'cancel' });

    await expect(promise).resolves.toBe(false);
    await Promise.resolve(); // wait for queueMicrotask in close()
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('suppresses duplicate confirm while loading and clears loading to allow confirm', async () => {
    const promise = component.confirmApproval(pendingUser);
    fixture.detectChanges();

    component.setLoading(true);
    component.handlePanelAction({ action: 'confirm' });
    component.handlePanelAction({ action: 'confirm' });
    expect(component.isOpen()).toBe(true);

    component.setLoading(false);
    component.handlePanelAction({ action: 'confirm' });

    await expect(promise).resolves.toBe(true);
  });

  it('does not import CDK focus, dialog, overlay, or Material modules', () => {
    const source = readFileSync(join(process.cwd(), 'apps/portal-web/src/app/features/users/users-confirmation-host.component.ts'), 'utf8');

    expect(source).not.toContain('@angular/cdk/dialog');
    expect(source).not.toContain('@angular/cdk/overlay');
    expect(source).not.toContain('@angular/cdk/a11y');
    expect(source).not.toContain('@angular/material');
    expect(source).not.toContain('FocusTrap');
    expect(source).not.toContain('DialogModule');
    expect(source).not.toContain('OverlayModule');
  });
});
