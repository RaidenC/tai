import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { describe, expect, it, beforeEach } from 'vitest';
import { InputComponent, TaiInputType } from './input.component';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent],
  template: `
    <tai-input
      id="email"
      type="email"
      placeholder="name@example.com"
      autocomplete="email"
      [invalid]="invalidValue"
      [formControl]="control"
    />
  `,
})
class HostComponent {
  invalidValue = true;
  readonly control = new FormControl('', { nonNullable: true });
}

describe('InputComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  describe('basic rendering', () => {
    it('renders the configured input attributes', () => {
      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      expect(input.id).toBe('email');
      expect(input.type).toBe('email');
      expect(input.placeholder).toBe('name@example.com');
      expect(input.autocomplete).toBe('email');
      expect(input.getAttribute('aria-invalid')).toBe('true');
    });

    it('writes user input through ControlValueAccessor', () => {
      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      input.value = 'admin@tai.com';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(fixture.componentInstance.control.value).toBe('admin@tai.com');
    });
  });

  describe('disabled state', () => {
    it('disables the input when form control is disabled', () => {
      fixture.componentInstance.control.disable();
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      expect(input.disabled).toBe(true);
    });
  });

  describe('validation states', () => {
    it('applies invalid styling when invalid is true', () => {
      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      expect(input.className).toContain('border-red-600');
    });
  });

  describe('blur handling', () => {
    it('handles blur event without error', () => {
      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();

      expect(input).toBeTruthy();
    });
  });

  describe('security', () => {
    it('does not use innerHTML binding', () => {
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[innerHTML]')).toBeNull();
    });
  });
});
