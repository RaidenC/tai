import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { OtpVerificationFormComponent } from './otp-verification-form';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('OtpVerificationFormComponent', () => {
  let component: OtpVerificationFormComponent;
  let fixture: ComponentFixture<OtpVerificationFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OtpVerificationFormComponent, ReactiveFormsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(OtpVerificationFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with an invalid form state', () => {
    expect(component.otpForm.valid).toBe(false);
  });

  it('should require a 6-digit code', () => {
    const otpControl = component.otpForm.get('code');

    otpControl?.setValue('12345');
    expect(otpControl?.errors?.['pattern']).toBeTruthy();

    otpControl?.setValue('1234567');
    expect(otpControl?.errors?.['pattern']).toBeTruthy();

    otpControl?.setValue('123456');
    expect(otpControl?.errors).toBeNull();
  });

  it('should emit the verified event when form is valid', () => {
    const verifySpy = vi.fn();
    component.verified.subscribe(verifySpy);

    component.otpForm.setValue({ code: '654321' });
    component.onSubmit();

    expect(verifySpy).toHaveBeenCalledWith('654321');
  });
});
