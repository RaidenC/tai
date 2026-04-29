import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { IconComponent } from './icon.component';

describe('IconComponent', () => {
  let fixture: ComponentFixture<IconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IconComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(IconComponent);
  });

  it('renders the menu icon with no innerHTML sink', () => {
    fixture.componentRef.setInput('name', 'more-vertical');
    fixture.detectChanges();

    const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.querySelectorAll('circle').length).toBe(3);
    expect(fixture.nativeElement.querySelector('[innerHTML]')).toBeNull();
  });

  it('supports accessible labeling when decorative is false', () => {
    fixture.componentRef.setInput('name', 'chevron-up-down');
    fixture.componentRef.setInput('ariaLabel', 'Sort');
    fixture.componentRef.setInput('decorative', false);
    fixture.detectChanges();

    const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
    expect(svg.getAttribute('aria-label')).toBe('Sort');
    expect(svg.getAttribute('role')).toBe('img');
  });
});
