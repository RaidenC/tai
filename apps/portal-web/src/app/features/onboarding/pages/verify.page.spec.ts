import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VerifyPage } from './verify.page';
import { OnboardingStore } from '../onboarding.store';
import { Router } from '@angular/router';
import { signal, WritableSignal } from '@angular/core';
import { OtpVerificationFormComponent } from '@tai/ui-design-system';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';

describe('VerifyPage', () => {
  let component: VerifyPage;
  let fixture: ComponentFixture<VerifyPage>;
  let mockStore: {
    status: WritableSignal<string>;
    isError: WritableSignal<boolean>;
    errorMessage: WritableSignal<string>;
    verify: Mock;
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
      verify: vi.fn(),
      reset: vi.fn()
    };

    mockRouter = {
      navigate: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [VerifyPage, OtpVerificationFormComponent],
      providers: [
        { provide: OnboardingStore, useValue: mockStore },
        { provide: Router, useValue: mockRouter }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(VerifyPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call store.verify when form is verified', () => {
    const code = '123456';
    const form = fixture.debugElement.query(By.directive(OtpVerificationFormComponent)).componentInstance;
    
    form.verified.emit(code);
    
    expect(mockStore.verify).toHaveBeenCalledWith(code);
  });

  it('should show error message when store has error', () => {
    mockStore.isError.set(true);
    mockStore.errorMessage.set('Invalid code');
    fixture.detectChanges();

    const errorDiv = fixture.debugElement.query(By.css('.text-red-700'));
    expect(errorDiv.nativeElement.textContent).toContain('Invalid code');
  });

  it('should navigate to /create-passkey and reset store on success', () => {
    mockStore.status.set('Success');
    fixture.detectChanges();

    expect(mockStore.reset).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/create-passkey']);
  });
});
