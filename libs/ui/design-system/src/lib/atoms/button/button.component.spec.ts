import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ButtonComponent } from './button.component';

describe('ButtonComponent', () => {
  let fixture: ComponentFixture<ButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ButtonComponent);
  });

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
