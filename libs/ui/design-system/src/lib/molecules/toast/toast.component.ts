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

  getSeverityClass(): string {
    const t = this.toast();
    if (!t) return '';
    return `toast-${t.severity}`;
  }
}