import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export type TaiInputType = 'text' | 'email' | 'password' | 'search' | 'number';

@Component({
  selector: 'tai-input',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './input.component.html',
  styleUrl: './input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputComponent),
      multi: true,
    },
  ],
})
export class InputComponent implements ControlValueAccessor {
  readonly id = input<string>('');
  readonly type = input<TaiInputType>('text');
  readonly placeholder = input<string>('');
  readonly autocomplete = input<string>('off');
  readonly invalid = input<boolean>(false);
  readonly describedBy = input<string>('');
  readonly value = input<string | null>(null);
  readonly valueChanged = output<string>();
  readonly blurred = output<void>();

  protected readonly controlValue = signal<string>('');
  protected readonly disabled = signal<boolean>(false);
  protected readonly displayValue = computed(() => this.value() ?? this.controlValue());

  protected readonly inputClasses = computed(() => {
    const base =
      'tai-input w-full rounded-md border bg-white px-4 py-3 text-base text-gray-900 shadow-sm outline-none transition-colors duration-200 placeholder:text-gray-400 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400';
    const state = this.invalid()
      ? ' border-red-600 focus:border-red-600 focus:ring-3 focus:ring-red-600/10'
      : ' border-gray-300 focus:border-blue-600 focus:ring-3 focus:ring-blue-600/10';
    return `${base}${state}`;
  });

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    this.controlValue.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected onInput(event: Event): void {
    const nextValue = (event.target as HTMLInputElement).value;
    this.controlValue.set(nextValue);
    this.onChange(nextValue);
    this.valueChanged.emit(nextValue);
  }

  protected onBlur(): void {
    this.onTouched();
    this.blurred.emit();
  }
}
