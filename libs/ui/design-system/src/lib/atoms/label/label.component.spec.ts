import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { LabelComponent } from './label.component';

describe('LabelComponent', () => {
  let fixture: ComponentFixture<LabelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LabelComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LabelComponent);
  });

  describe('basic rendering', () => {
    it('associates the label with the target control', () => {
      fixture.componentRef.setInput('forId', 'email');
      fixture.componentRef.setInput('text', 'Corporate Email');
      fixture.detectChanges();

      const label = fixture.nativeElement.querySelector('label') as HTMLLabelElement;
      expect(label.getAttribute('for')).toBe('email');
      expect(label.textContent).toContain('Corporate Email');
    });

    it('renders a required marker without injecting HTML', () => {
      fixture.componentRef.setInput('text', 'Password');
      fixture.componentRef.setInput('required', true);
      fixture.detectChanges();

      const marker = fixture.nativeElement.querySelector('[data-testid="required-marker"]');
      expect(marker.textContent.trim()).toBe('*');
      expect(fixture.nativeElement.querySelector('[innerHTML]')).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('renders without forId when not provided', () => {
      fixture.componentRef.setInput('text', 'Email');
      fixture.detectChanges();

      const label = fixture.nativeElement.querySelector('label') as HTMLLabelElement;
      expect(label.getAttribute('for')).toBeNull();
    });

    it('does not render required marker when required is false', () => {
      fixture.componentRef.setInput('text', 'Email');
      fixture.componentRef.setInput('required', false);
      fixture.detectChanges();

      const marker = fixture.nativeElement.querySelector('[data-testid="required-marker"]');
      expect(marker).toBeNull();
    });

    it('renders empty text without error', () => {
      fixture.componentRef.setInput('text', '');
      fixture.detectChanges();

      const label = fixture.nativeElement.querySelector('label') as HTMLLabelElement;
      expect(label.textContent.trim()).toBe('');
    });

    it('renders special characters safely in text', () => {
      fixture.componentRef.setInput('text', '<script>alert(1)</script>Name');
      fixture.detectChanges();

      const label = fixture.nativeElement.querySelector('label') as HTMLLabelElement;
      expect(label.textContent).toContain('<script>alert(1)</script>Name');
      expect(fixture.nativeElement.querySelector('script')).toBeNull();
    });
  });

  describe('accessibility', () => {
    it('has proper aria-hidden on required marker', () => {
      fixture.componentRef.setInput('text', 'Required Field');
      fixture.componentRef.setInput('required', true);
      fixture.detectChanges();

      const marker = fixture.nativeElement.querySelector('[data-testid="required-marker"]');
      expect(marker.getAttribute('aria-hidden')).toBe('true');
    });

    it('applies correct Tailwind classes', () => {
      fixture.componentRef.setInput('text', 'Label');
      fixture.detectChanges();

      const label = fixture.nativeElement.querySelector('label') as HTMLLabelElement;
      expect(label.className).toContain('text-sm');
      expect(label.className).toContain('font-semibold');
      expect(label.className).toContain('text-gray-700');
    });
  });
});
