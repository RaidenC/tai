import { Component, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormGroup,
  FormControl,
  Validators,
} from '@angular/forms';
import { SecureInputComponent } from '../secure-input/secure-input';

/**
 * RegistrationFormComponent
 *
 * Persona: Frontend Security Architect.
 * Context: Self-service registration for the TAI Portal.
 *
 * Features:
 * 1. Strongly typed Reactive Form for user registration.
 * 2. Integration with SecureInputComponent for secure, CSP-compliant inputs.
 * 3. Validation for email, names, and password complexity.
 */
@Component({
  selector: 'tai-registration-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SecureInputComponent],
  templateUrl: './registration-form.html',
  styleUrl: './registration-form.scss',
})
export class RegistrationFormComponent {
  /**
   * Strongly Typed Registration Form.
   */
  public readonly registrationForm = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    firstName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    lastName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8)],
    }),
  });

  /**
   * Emits the form data when valid and submitted.
   */
  public readonly submitted =
    output<Required<typeof this.registrationForm.value>>();

  /**
   * Handles form submission.
   */
  public onSubmit(): void {
    if (this.registrationForm.valid) {
      this.submitted.emit(
        this.registrationForm.getRawValue() as Required<
          typeof this.registrationForm.value
        >,
      );
    }
  }
}
