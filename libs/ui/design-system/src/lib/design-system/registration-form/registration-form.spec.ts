import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RegistrationFormComponent } from './registration-form';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('RegistrationFormComponent', () => {
  let component: RegistrationFormComponent;
  let fixture: ComponentFixture<RegistrationFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegistrationFormComponent, ReactiveFormsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(RegistrationFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with an invalid form state', () => {
    expect(component.registrationForm.valid).toBe(false);
  });

  it('should require all fields', () => {
    const form = component.registrationForm;
    expect(form.get('email')?.errors?.['required']).toBeTruthy();
    expect(form.get('firstName')?.errors?.['required']).toBeTruthy();
    expect(form.get('lastName')?.errors?.['required']).toBeTruthy();
    expect(form.get('password')?.errors?.['required']).toBeTruthy();
  });

  it('should validate email format', () => {
    const emailControl = component.registrationForm.get('email');
    emailControl?.setValue('invalid-email');
    expect(emailControl?.errors?.['email']).toBeTruthy();
    
    emailControl?.setValue('valid@example.com');
    expect(emailControl?.errors).toBeNull();
  });

  it('should require password minimum length', () => {
    const passwordControl = component.registrationForm.get('password');
    passwordControl?.setValue('short');
    expect(passwordControl?.errors?.['minlength']).toBeTruthy();
    
    passwordControl?.setValue('longenoughpassword');
    expect(passwordControl?.errors).toBeNull();
  });

  it('should emit the submitted event when form is valid', () => {
    const submitSpy = vi.fn();
    component.submitted.subscribe(submitSpy);

    const userData = {
      email: 'customer@example.com',
      firstName: 'John',
      lastName: 'Doe',
      password: 'SecurePassword123!'
    };
    
    component.registrationForm.setValue(userData);
    component.onSubmit();

    expect(submitSpy).toHaveBeenCalledWith(userData);
  });
});
