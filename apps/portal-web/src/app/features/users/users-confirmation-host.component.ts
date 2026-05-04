import { AfterViewChecked, ChangeDetectionStrategy, Component, ElementRef, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ConfirmationPanelActionSelected,
  ConfirmationPanelComponent,
  ConfirmationPanelData,
} from '@tai/ui-design-system';
import { User } from './users.service';

@Component({
  selector: 'app-users-confirmation-host',
  standalone: true,
  imports: [CommonModule, ConfirmationPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isOpen()) {
      <!-- eslint-disable-next-line @angular-eslint/template/interactive-supports-focus -->
      <div
        class="fixed inset-0 z-50 flex min-h-dvh items-center justify-center bg-gray-950/45 px-4 py-6"
        data-testid="users-confirmation-backdrop"
        role="presentation"
        (click)="onBackdropClick($event)"
      >
        <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events -->
        <div
          class="w-full max-w-md"
          data-testid="users-confirmation-host"
          #hostPanel
          role="dialog"
          aria-modal="true"
          (click)="$event.stopPropagation()"
          (keydown)="onKeydown($event)"
        >
          <tai-confirmation-panel
            [data]="panelData()"
            (actionSelected)="handlePanelAction($event)"
          />
        </div>
      </div>
    }
  `,
})
export class UsersConfirmationHostComponent implements AfterViewChecked {
  readonly isOpen = signal(false);
  readonly panelData = signal<ConfirmationPanelData>({
    title: 'Approve User Registration',
    message: 'Please review this action before continuing.',
    confirm: {
      label: 'Approve User',
      tone: 'default',
    },
    cancel: {
      label: 'Cancel',
    },
    initialFocus: 'confirm',
  });

  private readonly hostPanel = viewChild<ElementRef<HTMLElement>>('hostPanel');
  private resolver: ((confirmed: boolean) => void) | null = null;
  private opener: HTMLElement | null = null;
  private needsInitialFocus = false;
  private loading = false;

  confirmApproval(user: User): Promise<boolean> {
    if (this.resolver) {
      this.close(false);
    }

    this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.loading = false;
    this.panelData.set({
      title: 'Approve User Registration',
      message: `Are you sure you want to approve the registration for ${user.firstName} ${user.lastName} (${user.email})? This will grant them access to the platform immediately.`,
      confirm: {
        label: 'Approve User',
        tone: 'default',
      },
      cancel: {
        label: 'Cancel',
      },
      initialFocus: 'confirm',
    });
    this.isOpen.set(true);
    this.needsInitialFocus = true;

    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  openConfirmation(data: ConfirmationPanelData): Promise<boolean> {
    if (this.resolver) {
      this.close(false);
    }

    this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.loading = false;
    this.panelData.set(data);
    this.isOpen.set(true);
    this.needsInitialFocus = true;

    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  ngAfterViewChecked(): void {
    if (!this.needsInitialFocus) {
      return;
    }

    this.needsInitialFocus = false;
    queueMicrotask(() => this.focusInitialElement());
  }

  setLoading(loading: boolean): void {
    this.loading = loading;
    const current = this.panelData();
    this.panelData.set({
      ...current,
      confirm: {
        ...current.confirm,
        loading,
      },
    });
  }

  handlePanelAction(event: ConfirmationPanelActionSelected): void {
    if (event.action === 'confirm') {
      if (this.loading) {
        return;
      }
      this.close(true);
      return;
    }

    this.close(false);
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close(false);
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close(false);
      return;
    }

    if (event.key === 'Tab') {
      this.loopFocus(event);
    }
  }

  private close(confirmed: boolean): void {
    const resolver = this.resolver;
    this.resolver = null;
    this.loading = false;
    this.isOpen.set(false);
    resolver?.(confirmed);
    // Defer focus restoration to ensure Angular's change detection completes first
    queueMicrotask(() => this.restoreFocus());
  }

  private focusInitialElement(): void {
    const host = this.hostPanel()?.nativeElement;
    if (!host) {
      return;
    }

    // Use explicit initialFocus if provided, otherwise default based on tone
    const data = this.panelData();
    const tone = data.confirm?.tone;
    const explicitFocus = data.initialFocus;
    const defaultFocus = tone === 'danger' ? 'cancel' : 'confirm';
    const focusTarget = explicitFocus ?? defaultFocus;

    const target = host.querySelector<HTMLElement>(`[data-confirmation-focus="${focusTarget}"]`)
      ?? this.focusableElements(host)[0];
    target?.focus();
  }

  private loopFocus(event: KeyboardEvent): void {
    const host = this.hostPanel()?.nativeElement;
    if (!host) {
      return;
    }

    const focusable = this.focusableElements(host);
    if (focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private focusableElements(host: HTMLElement): HTMLElement[] {
    return Array.from(
      host.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
  }

  private restoreFocus(): void {
    // Restore focus to the opener element
    const opener = this.opener;
    this.opener = null;
    if (opener) {
      // Only focus if the element is still connected to DOM
      try {
        if (opener.isConnected) {
          opener.focus();
        }
      } catch {
        // Ignore errors during focus restoration
      }
    }
  }
}
