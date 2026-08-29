import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from './toast.service';

@Component({
  selector: 'tai-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.scss',
})
export class ToastComponent {
  private readonly toastService = inject(ToastService);

  readonly toast = this.toastService.toast;

  dismiss(): void {
    this.toastService.hide();
  }

  getToastClasses(): string {
    const t = this.toast();
    if (!t) return '';

    const severityClasses = {
      critical: 'bg-red-50 border border-red-600 text-red-800',
      warning: 'bg-amber-50 border border-amber-500 text-amber-800',
      info: 'bg-blue-50 border border-blue-500 text-blue-800',
    } as const;

    return [
      'toast',
      `toast-${t.severity}`,
      'fixed top-20 right-6 flex max-w-[400px] items-center gap-3 rounded-lg p-3 px-4 shadow-[0_4px_12px_rgba(0,0,0,0.15)] animate-[slideDown_0.3s_ease-out] z-[200]',
      severityClasses[t.severity],
    ].join(' ');
  }
}
