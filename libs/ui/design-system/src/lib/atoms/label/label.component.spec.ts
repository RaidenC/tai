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
