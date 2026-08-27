import { Component, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormGroup,
  FormControl,
  Validators,
} from '@angular/forms';
import { InputComponent } from '../../atoms/input/input.component';
import { ButtonComponent } from '../../atoms/button/button.component';
import { FormFieldComponent } from '../../molecules/form-field/form-field.component';

/**
 * LoginFormComponent
 *
 * Persona: Frontend Security Architect.
 * Context: Composition of secure identity inputs into a strictly typed reactive form.
 *
 * Features:
 * 1. Strongly typed FormGroup model.
 * 2. Composition of InputComponent for identity isolation.
 * 3. Reactive validation state binding for the submission layer.
 */
@Component({
  selector: 'tai-login-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonComponent,
    InputComponent,
    FormFieldComponent,
  ],
  templateUrl: './login-form.html',
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
  public readonly submitted = output<Required<typeof this.loginForm.value>>();

  /**
   * Handles the native form submission event.
   */
  public onSubmit(): void {
    if (this.loginForm.valid) {
      // getRawValue() ensures we get the non-nullable strings as defined in the model.
      this.submitted.emit(
        this.loginForm.getRawValue() as Required<typeof this.loginForm.value>,
      );
    }
  }

  public getEmailError(): string {
    const control = this.loginForm.controls.email;
    if (!control.touched || control.valid) {
      return '';
    }
    return 'A valid corporate email is required.';
  }

  public getPasswordError(): string {
    const control = this.loginForm.controls.password;
    if (!control.touched || control.valid) {
      return '';
    }
    return 'Password must be at least 8 characters.';
  }
}
