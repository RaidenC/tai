import { Component, input, output } from '@angular/core';

@Component({
  selector: 'tai-security-alert',
  standalone: true,
  template: `
    @if (visible()) {
      <div
        class="security-alert"
        [class.security-alert--warning]="severity() === 'warning'"
        [class.security-alert--info]="severity() === 'info'"
        role="alert"
        aria-live="polite"
        data-testid="security-alert"
      >
        <span class="security-alert__icon" aria-hidden="true">&#x1f512;</span>
        <span class="security-alert__message">{{ message() }}</span>
        @if (dismissible()) {
          <button
            type="button"
            class="security-alert__dismiss"
            aria-label="Dismiss alert"
            (click)="dismissed.emit()"
            data-testid="security-alert-dismiss"
          >
            &times;
          </button>
        }
      </div>
    }
  `,
  styles: `
    .security-alert {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      line-height: 1.25rem;
    }
    .security-alert--warning {
      background-color: #fef3c7;
      border: 1px solid #f59e0b;
      color: #92400e;
    }
    .security-alert--info {
      background-color: #dbeafe;
      border: 1px solid #3b82f6;
      color: #1e40af;
    }
    .security-alert__dismiss {
      margin-left: auto;
      background: none;
      border: none;
      font-size: 1.25rem;
      cursor: pointer;
      color: inherit;
      padding: 0 0.25rem;
    }
  `,
})
export class SecurityAlertComponent {
  message = input.required<string>();
  severity = input<'warning' | 'info'>('warning');
  visible = input<boolean>(true);
  dismissible = input<boolean>(false);
  dismissed = output<void>();
}
