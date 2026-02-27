import { Component, input, signal, computed, inject, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { TrustedTypesService } from './trusted-types.service';

/**
 * SecureInputComponent
 * 
 * Persona: Frontend Security Architect.
 * Context: Secure Login UI for TAI Portal (PCI DSS & SOC 2 Compliance).
 * 
 * This component provides a strictly controlled DOM for sensitive identity inputs,
 * avoiding third-party libraries that violate CSP via inline styles.
 */
@Component({
  selector: 'tai-secure-input',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './secure-input.html',
  styleUrl: './secure-input.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SecureInputComponent),
      multi: true,
    },
  ],
})
export class SecureInputComponent implements ControlValueAccessor {
  private readonly ttService = inject(TrustedTypesService);

  /**
   * Public API using Signal Inputs (Angular 21 standard).
   */
  label = input<string>('');
  type = input<'text' | 'email' | 'password'>('text');
  placeholder = input<string>('');
  errorMessage = input<string>('');
  id = input<string>(`input-${Math.random().toString(36).substr(2, 9)}`);

  /**
   * Internal Reactive State.
   */
  protected readonly value = signal<string>('');
  protected readonly isDisabled = signal<boolean>(false);
  protected readonly isTouched = signal<boolean>(false);

  /**
   * Trusted Types Integration:
   * Ensures that dynamic error messages are sanitized before being 
   * bound to the [innerHTML] sink, preventing DOM-based XSS.
   */
  protected readonly trustedErrorMessage = computed(() => {
    return this.ttService.createTrustedHTML(this.errorMessage());
  });

  // ControlValueAccessor Interface Implementation
  private onChange: (value: string) => void = (value: string) => {
    // Placeholder for ControlValueAccessor
    this.value.set(value);
  };
  private onTouched: () => void = () => {
    // Placeholder for ControlValueAccessor
    this.isTouched.set(true);
  };

  writeValue(value: string): void {
    this.value.set(value || '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }

  // UI Event Handlers
  protected onInput(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    this.value.set(inputElement.value);
    this.onChange(inputElement.value);
  }

  protected onBlur(): void {
    this.isTouched.set(true);
    this.onTouched();
  }

  /**
   * Autofill Stealer Log Defense:
   * Browsers often ignore autocomplete="off" for identity fields.
   * Using "new-password" forces the browser to treat the field as 
   * sensitive, reducing the chance of accidental population of 
   * stored credentials that malware could then extract.
   */
  protected get autocompleteValue(): string {
    if (this.type() === 'password') {
      return 'new-password';
    }
    return this.type() === 'email' ? 'email' : 'off';
  }
}
