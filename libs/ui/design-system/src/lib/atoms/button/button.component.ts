import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type TaiButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type TaiButtonType = 'button' | 'submit' | 'reset';

@Component({
  selector: 'tai-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './button.component.html',
  styleUrl: './button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ButtonComponent {
  readonly type = input<TaiButtonType>('button');
  readonly variant = input<TaiButtonVariant>('primary');
  readonly disabled = input<boolean>(false);
  readonly ariaLabel = input<string>('');
  readonly testId = input<string>('');
  readonly pressed = output<MouseEvent>();

  protected readonly buttonClasses = computed(() => {
    const base =
      'tai-button inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold outline-none transition-colors duration-200 focus:ring-3 disabled:cursor-not-allowed disabled:opacity-60';
    const variants: Record<TaiButtonVariant, string> = {
      primary: ' bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-600/20',
      secondary: ' border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 focus:ring-gray-400/20',
      ghost: ' bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-400/20',
      danger: ' bg-red-600 text-white hover:bg-red-700 focus:ring-red-600/20',
    };
    return `${base}${variants[this.variant()]}`;
  });

  protected onClick(event: MouseEvent): void {
    if (this.disabled()) {
      event.preventDefault();
      return;
    }
    this.pressed.emit(event);
  }
}
