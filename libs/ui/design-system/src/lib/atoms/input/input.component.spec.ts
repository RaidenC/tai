import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { describe, expect, it, beforeEach } from 'vitest';
import { InputComponent } from './input.component';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent],
  template: `
    <tai-input
      id="email"
      type="email"
      placeholder="name@example.com"
      autocomplete="email"
      [invalid]="true"
      [formControl]="control"
    />
  `,
})
class HostComponent {
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
