import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { LoginFormComponent } from './login-form';
import { SecureInputComponent } from '../secure-input/secure-input';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('LoginFormComponent', () => {
  let component: LoginFormComponent;
  let fixture: ComponentFixture<LoginFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginFormComponent, SecureInputComponent, ReactiveFormsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with an invalid form state', () => {
    expect(component.loginForm.valid).toBe(false);
  });

  it('should enable the submit button only when the form is valid', async () => {
    const submitBtn = fixture.debugElement.query(By.css('.submit-button'))
      .nativeElement as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);

    component.loginForm.controls.email.setValue('admin@tai.com');
    component.loginForm.controls.password.setValue('SecurePass123!');
    fixture.detectChanges();

    expect(component.loginForm.valid).toBe(true);
    expect(submitBtn.disabled).toBe(false);
  });

  it('should emit the submitted event with form values', () => {
    const submitSpy = vi.fn();
    component.submitted.subscribe(submitSpy);

    const credentials = { email: 'admin@tai.com', password: 'SecurePass123!' };
    component.loginForm.setValue(credentials);
    component.onSubmit();

    expect(submitSpy).toHaveBeenCalledWith(credentials);
  });

  it('should not emit the submitted event if the form is invalid', () => {
    const submitSpy = vi.fn();
    component.submitted.subscribe(submitSpy);

    component.loginForm.controls.email.setValue('invalid-email');
    component.onSubmit();

    expect(submitSpy).not.toHaveBeenCalled();
  });
});
