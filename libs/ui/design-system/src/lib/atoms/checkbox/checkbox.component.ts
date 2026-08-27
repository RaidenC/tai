import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'tai-checkbox',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './checkbox.component.html',
  host: {
    class: 'inline-flex',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CheckboxComponent),
      multi: true,
    },
  ],
})
export class CheckboxComponent implements ControlValueAccessor {
  readonly id = input<string>('');
  readonly ariaLabel = input<string>('');
  readonly invalid = input<boolean>(false);

  protected readonly checked = signal<boolean>(false);
  protected readonly disabled = signal<boolean>(false);

  protected readonly checkboxClasses = computed(() => {
    const base =
      'tai-checkbox h-4 w-4 rounded border bg-white text-blue-600 outline-none transition-colors duration-200 focus:ring-3 disabled:cursor-not-allowed disabled:opacity-60';
    const state = this.invalid()
      ? ' border-red-600 focus:ring-red-600/20'
      : ' border-gray-300 focus:ring-blue-600/20';
    return `${base}${state}`;
  });

  private onChange: (value: boolean) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: boolean | null): void {
    this.checked.set(Boolean(value));
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected onInput(event: Event): void {
    const nextChecked = (event.target as HTMLInputElement).checked;
    this.checked.set(nextChecked);
    this.onChange(nextChecked);
  }

  protected onBlur(): void {
    this.onTouched();
  }
}
