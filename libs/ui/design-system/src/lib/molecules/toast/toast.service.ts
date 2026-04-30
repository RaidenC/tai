import { Injectable, signal, computed } from '@angular/core';

export interface Toast {
  message: string;
  severity: 'critical' | 'warning' | 'info';
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private readonly _toast = signal<Toast | null>(null);

  readonly toast = computed(() => this._toast());

  show(message: string, severity: 'critical' | 'warning' | 'info' = 'info'): void {
    this._toast.set({
      message,
      severity,
      timestamp: Date.now()
    });
  }

  hide(): void {
    this._toast.set(null);
  }
}