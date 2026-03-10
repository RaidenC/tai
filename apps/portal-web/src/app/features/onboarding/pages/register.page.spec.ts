import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegisterPage } from './register.page';
import { OnboardingStore } from '../onboarding.store';
import { Router } from '@angular/router';
import { signal, WritableSignal } from '@angular/core';
import { RegistrationFormComponent } from '@tai/ui-design-system';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';

describe('RegisterPage', () => {
  let component: RegisterPage;
  let fixture: ComponentFixture<RegisterPage>;
  let mockStore: {
    status: WritableSignal<string>;
    isError: WritableSignal<boolean>;
    errorMessage: WritableSignal<string>;
    register: Mock;
    reset: Mock;
  };
  let mockRouter: {
    navigate: Mock;
  };

  beforeEach(async () => {
    mockStore = {
      status: signal('Idle'),
      isError: signal(false),
      errorMessage: signal(''),
      register: vi.fn(),
      reset: vi.fn()
    };

    mockRouter = {
      navigate: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [RegisterPage, RegistrationFormComponent],
      providers: [
        { provide: OnboardingStore, useValue: mockStore },
        { provide: Router, useValue: mockRouter }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call store.register when form is submitted', () => {
    const registrationData = { email: 'test@tai.com', password: 'Password123!', firstName: 'Test', lastName: 'User' };
    const form = fixture.debugElement.query(By.directive(RegistrationFormComponent)).componentInstance;
    
    form.submitted.emit(registrationData);
    
    expect(mockStore.register).toHaveBeenCalledWith(registrationData);
  });

  it('should show error message when store has error', () => {
    mockStore.isError.set(true);
    mockStore.errorMessage.set('Invalid email');
    fixture.detectChanges();

    const errorDiv = fixture.debugElement.query(By.css('.text-red-700'));
    expect(errorDiv.nativeElement.textContent).toContain('Invalid email');
  });

  it('should navigate to /verify and reset store on success', () => {
    mockStore.status.set('Success');
    fixture.detectChanges();

    expect(mockStore.reset).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/verify']);
  });
});
