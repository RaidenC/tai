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

  describe('basic rendering', () => {
    it('renders label with for attribute', () => {
      fixture.componentRef.setInput('controlId', 'email');
      fixture.componentRef.setInput('label', 'Corporate Email');
      fixture.detectChanges();

      const label = fixture.nativeElement.querySelector('label') as HTMLLabelElement;
      expect(label.getAttribute('for')).toBe('email');
      expect(label.textContent).toContain('Corporate Email');
    });

    it('renders required marker when required is true', () => {
      fixture.componentRef.setInput('controlId', 'email');
      fixture.componentRef.setInput('label', 'Email');
      fixture.componentRef.setInput('required', true);
      fixture.detectChanges();

      const marker = fixture.nativeElement.querySelector('[data-testid="required-marker"]');
      expect(marker).toBeTruthy();
    });

    it('does not render required marker when required is false', () => {
      fixture.componentRef.setInput('controlId', 'email');
      fixture.componentRef.setInput('label', 'Email');
      fixture.componentRef.setInput('required', false);
      fixture.detectChanges();

      const marker = fixture.nativeElement.querySelector('[data-testid="required-marker"]');
      expect(marker).toBeNull();
    });
  });

  describe('hint rendering', () => {
    it('renders hint when provided', () => {
      fixture.componentRef.setInput('controlId', 'email');
      fixture.componentRef.setInput('label', 'Email');
      fixture.componentRef.setInput('hint', 'Enter your email');
      fixture.detectChanges();

      const hint = fixture.nativeElement.querySelector('[data-testid="form-field-hint"]') as HTMLElement;
      expect(hint.textContent).toContain('Enter your email');
    });

    it('does not render hint when empty', () => {
      fixture.componentRef.setInput('controlId', 'email');
      fixture.componentRef.setInput('label', 'Email');
      fixture.componentRef.setInput('hint', '');
      fixture.detectChanges();

      const hint = fixture.nativeElement.querySelector('[data-testid="form-field-hint"]');
      expect(hint).toBeNull();
    });
  });

  describe('error rendering', () => {
    it('renders error when provided', () => {
      fixture.componentRef.setInput('controlId', 'email');
      fixture.componentRef.setInput('label', 'Email');
      fixture.componentRef.setInput('error', 'Invalid email');
      fixture.detectChanges();

      const error = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
      expect(error.textContent).toContain('Invalid email');
    });

    it('does not render error when empty', () => {
      fixture.componentRef.setInput('controlId', 'email');
      fixture.componentRef.setInput('label', 'Email');
      fixture.componentRef.setInput('error', '');
      fixture.detectChanges();

      const error = fixture.nativeElement.querySelector('[role="alert"]');
      expect(error).toBeNull();
    });

    it('uses textContent for error (no XSS)', () => {
      fixture.componentRef.setInput('controlId', 'email');
      fixture.componentRef.setInput('label', 'Email');
      fixture.componentRef.setInput('error', '<script>alert(1)</script>Invalid');
      fixture.detectChanges();

      const error = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
      expect(error.textContent).toContain('<script>alert(1)</script>Invalid');
      expect(error.querySelector('script')).toBeNull();
    });
  });

  describe('accessibility', () => {
    it('has aria-live on error message', () => {
      fixture.componentRef.setInput('controlId', 'email');
      fixture.componentRef.setInput('label', 'Email');
      fixture.componentRef.setInput('error', 'Error');
      fixture.detectChanges();

      const error = fixture.nativeElement.querySelector('[role="alert"]');
      expect(error.getAttribute('aria-live')).toBe('polite');
    });
  });

  describe('content projection', () => {
    it('renders projected content', () => {
      fixture.componentRef.setInput('controlId', 'email');
      fixture.componentRef.setInput('label', 'Email');
      fixture.detectChanges();

      const container = fixture.nativeElement.querySelector('.tai-form-field');
      expect(container).toBeTruthy();
    });
  });
});
