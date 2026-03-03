import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { SecureInputComponent } from '../secure-input/secure-input';

/**
 * LoginFormComponent
 * 
 * Persona: Frontend Security Architect.
 * Context: Composition of secure identity inputs into a strictly typed reactive form.
 * 
 * Features:
 * 1. Strongly typed FormGroup model.
 * 2. Composition of SecureInputComponent for identity isolation.
 * 3. Reactive validation state binding for the submission layer.
 */
@Component({
  selector: 'tai-login-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SecureInputComponent],
  templateUrl: './login-form.html',
  styleUrl: './login-form.scss',
})
export class LoginFormComponent {
  /**
   * Strongly Typed Form Model:
   * Provides type safety for identity credentials (email/password).
   */
  public readonly loginForm = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8)],
    }),
  });

  /**
   * Event emitted when the form passes validation and is submitted by the user.
   */
  @Output() submitted = new EventEmitter<Required<typeof this.loginForm.value>>();

  /**
   * Handles the native form submission event.
   */
  public onSubmit(): void {
    if (this.loginForm.valid) {
      // getRawValue() ensures we get the non-nullable strings as defined in the model.
      this.submitted.emit(this.loginForm.getRawValue() as Required<typeof this.loginForm.value>);
    }
  }
}
