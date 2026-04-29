import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
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
    fixture.componentInstance.registerOnTouched(() => {});

    checkbox.click();
    fixture.detectChanges();

    expect(currentValue).toBe(true);
  });
});
