import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { FormFieldComponent } from './form-field.component';

describe('FormFieldComponent', () => {
  let fixture: ComponentFixture<FormFieldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormFieldComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FormFieldComponent);
  });

  it('renders label, hint, and text-only error', () => {
    fixture.componentRef.setInput('controlId', 'email');
    fixture.componentRef.setInput('label', 'Corporate Email');
    fixture.componentRef.setInput('hint', 'Use your company email.');
    fixture.componentRef.setInput('error', '<script>alert(1)</script>Invalid email');
    fixture.componentRef.setInput('required', true);
    fixture.detectChanges();

    const label = fixture.nativeElement.querySelector('label') as HTMLLabelElement;
    const hint = fixture.nativeElement.querySelector('[data-testid="form-field-hint"]') as HTMLElement;
    const error = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;

    expect(label.getAttribute('for')).toBe('email');
    expect(hint.textContent).toContain('Use your company email.');
    expect(error.textContent).toContain('<script>alert(1)</script>Invalid email');
    expect(error.querySelector('script')).toBeNull();
  });
});
