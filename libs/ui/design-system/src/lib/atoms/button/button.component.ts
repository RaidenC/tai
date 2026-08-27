import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type TaiButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type TaiButtonType = 'button' | 'submit' | 'reset';
export type TaiButtonShape = 'rounded' | 'circle';

@Component({
  selector: 'tai-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './button.component.html',
  host: {
    class: 'inline-flex',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ButtonComponent {
  readonly type = input<TaiButtonType>('button');
  readonly variant = input<TaiButtonVariant>('primary');
  readonly shape = input<TaiButtonShape>('rounded');
  readonly iconOnly = input<boolean>(false);
  readonly disabled = input<boolean>(false);
  readonly ariaLabel = input<string>('');
  readonly ariaExpanded = input<boolean | null>(null);
  readonly ariaControls = input<string | null>(null);
  readonly testId = input<string>('');
  readonly pressed = output<MouseEvent>();

  protected readonly buttonClasses = computed(() => {
    const base =
      `tai-button inline-flex items-center justify-center gap-2 ${
        this.shape() === 'circle' ? 'rounded-full' : 'rounded-md'
      } ${this.iconOnly() ? 'h-12 w-12 p-0' : 'min-h-11 px-4 py-2'} text-sm font-semibold outline-none transition-colors duration-200 focus:ring-3 disabled:cursor-not-allowed disabled:opacity-60`;
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
