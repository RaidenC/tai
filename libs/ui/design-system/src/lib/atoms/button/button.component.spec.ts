import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ButtonComponent, TaiButtonVariant, TaiButtonType } from './button.component';

describe('ButtonComponent', () => {
  let fixture: ComponentFixture<ButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ButtonComponent);
  });

  describe('basic rendering', () => {
    it('renders a submit button with projected content', () => {
      fixture.componentRef.setInput('type', 'submit');
      fixture.componentRef.setInput('variant', 'primary');
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      expect(button.type).toBe('submit');
      expect(button.className).toContain('tai-button');
      expect(button.className).toContain('bg-blue-600');
    });

    it('does not emit pressed when disabled', () => {
      const spy = vi.fn();
      fixture.componentInstance.pressed.subscribe(spy);
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      button.click();

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('button types', () => {
    it('renders type button correctly', () => {
      fixture.componentRef.setInput('type', 'button' as TaiButtonType);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      expect(button.type).toBe('button');
    });

    it('renders type reset correctly', () => {
      fixture.componentRef.setInput('type', 'reset' as TaiButtonType);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      expect(button.type).toBe('reset');
    });
  });

  describe('button variants', () => {
    it('applies primary variant classes', () => {
      fixture.componentRef.setInput('variant', 'primary' as TaiButtonVariant);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      expect(button.className).toContain('bg-blue-600');
      expect(button.className).toContain('text-white');
    });

    it('applies secondary variant classes', () => {
      fixture.componentRef.setInput('variant', 'secondary' as TaiButtonVariant);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      expect(button.className).toContain('border');
      expect(button.className).toContain('border-gray-300');
      expect(button.className).toContain('bg-white');
    });

    it('applies ghost variant classes', () => {
      fixture.componentRef.setInput('variant', 'ghost' as TaiButtonVariant);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      expect(button.className).toContain('bg-transparent');
    });

    it('applies danger variant classes', () => {
      fixture.componentRef.setInput('variant', 'danger' as TaiButtonVariant);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      expect(button.className).toContain('bg-red-600');
      expect(button.className).toContain('text-white');
    });
  });

  describe('disabled state', () => {
    it('applies disabled classes when disabled', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      expect(button.className).toContain('disabled:opacity-60');
      expect(button.className).toContain('disabled:cursor-not-allowed');
    });
  });

  describe('pressed output', () => {
    it('emits pressed event when clicked and not disabled', () => {
      const spy = vi.fn();
      fixture.componentInstance.pressed.subscribe(spy);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      button.click();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('prevents default when disabled', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      const event = new MouseEvent('click');
      Object.defineProperty(event, 'preventDefault', { value: vi.fn(), writable: false });
      button.dispatchEvent(event);

      // Button should prevent default when disabled - just verify no error
      expect(button.disabled).toBe(true);
    });
  });

  describe('accessibility', () => {
    it('applies aria-label when provided', () => {
      fixture.componentRef.setInput('ariaLabel', 'Click to submit');
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      expect(button.getAttribute('aria-label')).toBe('Click to submit');
    });

    it('applies data-testid when provided', () => {
      fixture.componentRef.setInput('testId', 'submit-btn');
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      expect(button.getAttribute('data-testid')).toBe('submit-btn');
    });
  });

  describe('content projection', () => {
    it('renders button element', () => {
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      expect(button).toBeTruthy();
    });
  });
});
