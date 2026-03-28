import { Component, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormGroup,
  FormControl,
  Validators,
} from '@angular/forms';
import { SecureInputComponent } from '../secure-input/secure-input';

@Component({
  selector: 'tai-otp-verification-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SecureInputComponent],
  templateUrl: './otp-verification-form.html',
  styleUrl: './otp-verification-form.scss',
})
export class OtpVerificationFormComponent {
  public readonly otpForm = new FormGroup({
    code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^[0-9]{6}$/)],
    }),
  });

  public readonly verified = output<string>();

  public onSubmit(): void {
    if (this.otpForm.valid) {
      this.verified.emit(this.otpForm.getRawValue().code);
    }
  }
}
