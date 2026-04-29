import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { describe, expect, it, beforeEach } from 'vitest';
import { CheckboxComponent } from './checkbox.component';

describe('CheckboxComponent', () => {
  let fixture: ComponentFixture<CheckboxComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, CheckboxComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CheckboxComponent);
  });

  describe('basic rendering', () => {
    it('renders a checkbox element', () => {
      fixture.detectChanges();

      const checkbox = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      expect(checkbox.type).toBe('checkbox');
    });

    it('writes checked state through ControlValueAccessor', () => {
      fixture.detectChanges();

      const checkbox = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      // Connect to form control via CVA
      let currentValue = false;
      fixture.componentInstance.registerOnChange((value: boolean) => {
        currentValue = value;
      });
      fixture.componentInstance.registerOnTouched(() => {
        // noop for test - callback required by ControlValueAccessor interface
      });

      checkbox.click();
      fixture.detectChanges();

      expect(currentValue).toBe(true);
    });
  });

  describe('disabled state', () => {
    it('disables the checkbox when setDisabledState is called', () => {
      fixture.componentInstance.setDisabledState(true);
      fixture.detectChanges();

      const checkbox = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      expect(checkbox.disabled).toBe(true);
    });

    it('applies disabled styling when disabled', () => {
      fixture.componentInstance.setDisabledState(true);
      fixture.detectChanges();

      const checkbox = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      expect(checkbox.className).toContain('disabled:opacity-60');
      expect(checkbox.className).toContain('disabled:cursor-not-allowed');
    });
  });

  describe('checked state', () => {
    it('reflects checked state in template', () => {
      fixture.componentInstance.writeValue(true);
      fixture.detectChanges();

      const checkbox = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });

    it('reflects unchecked state in template', () => {
      fixture.componentInstance.writeValue(false);
      fixture.detectChanges();

      const checkbox = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
    });

    it('toggles checked state on click', () => {
      fixture.detectChanges();

      const checkbox = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);

      checkbox.click();
      fixture.detectChanges();
      expect(checkbox.checked).toBe(true);

      checkbox.click();
      fixture.detectChanges();
      expect(checkbox.checked).toBe(false);
    });
  });

  describe('invalid state', () => {
    it('applies invalid styling when invalid is true', () => {
      fixture.componentRef.setInput('invalid', true);
      fixture.detectChanges();

      const checkbox = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      expect(checkbox.className).toContain('border-red-600');
    });

    it('applies default styling when invalid is false', () => {
      fixture.componentRef.setInput('invalid', false);
      fixture.detectChanges();

      const checkbox = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      expect(checkbox.className).toContain('border-gray-300');
    });

    it('sets aria-invalid when invalid is true', () => {
      fixture.componentRef.setInput('invalid', true);
      fixture.detectChanges();

      const checkbox = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      expect(checkbox.getAttribute('aria-invalid')).toBe('true');
    });
  });

  describe('accessibility', () => {
    it('renders with id when provided', () => {
      fixture.componentRef.setInput('id', 'agree-terms');
      fixture.detectChanges();

      const checkbox = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      expect(checkbox.id).toBe('agree-terms');
    });

    it('renders aria-label when provided', () => {
      fixture.componentRef.setInput('ariaLabel', 'I agree to the terms');
      fixture.detectChanges();

      const checkbox = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      expect(checkbox.getAttribute('aria-label')).toBe('I agree to the terms');
    });
  });

  describe('blur handling', () => {
    it('calls onTouched on blur', () => {
      const touchSpy = vi.fn();
      fixture.componentInstance.registerOnTouched(touchSpy);
      fixture.detectChanges();

      const checkbox = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      checkbox.dispatchEvent(new Event('blur'));
      fixture.detectChanges();

      expect(touchSpy).toHaveBeenCalled();
    });
  });

  describe('security', () => {
    it('does not use innerHTML binding', () => {
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[innerHTML]')).toBeNull();
    });
  });
});
