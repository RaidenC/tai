import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { IconComponent, TaiIconName } from './icon.component';

describe('IconComponent', () => {
  let fixture: ComponentFixture<IconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IconComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(IconComponent);
  });

  describe('basic rendering', () => {
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

  describe('icon types', () => {
    it('renders chevron-up icon', () => {
      fixture.componentRef.setInput('name', 'chevron-up' as TaiIconName);
      fixture.detectChanges();

      const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
      expect(svg).toBeTruthy();
      expect(svg.querySelector('path')).toBeTruthy();
    });

    it('renders chevron-down icon', () => {
      fixture.componentRef.setInput('name', 'chevron-down' as TaiIconName);
      fixture.detectChanges();

      const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
      expect(svg).toBeTruthy();
    });

    it('renders search icon', () => {
      fixture.componentRef.setInput('name', 'search' as TaiIconName);
      fixture.detectChanges();

      const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
      expect(svg).toBeTruthy();
    });

    it('renders empty-state icon', () => {
      fixture.componentRef.setInput('name', 'empty-state' as TaiIconName);
      fixture.detectChanges();

      const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
      expect(svg).toBeTruthy();
    });
  });

  describe('size variants', () => {
    it('applies small size classes', () => {
      fixture.componentRef.setInput('name', 'more-vertical' as TaiIconName);
      fixture.componentRef.setInput('size', 'sm');
      fixture.detectChanges();

      const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
      expect(svg.classList.contains('h-4')).toBe(true);
      expect(svg.classList.contains('w-4')).toBe(true);
    });

    it('applies medium size classes (default)', () => {
      fixture.componentRef.setInput('name', 'more-vertical' as TaiIconName);
      fixture.componentRef.setInput('size', 'md');
      fixture.detectChanges();

      const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
      expect(svg.classList.contains('h-5')).toBe(true);
      expect(svg.classList.contains('w-5')).toBe(true);
    });

    it('applies large size classes', () => {
      fixture.componentRef.setInput('name', 'more-vertical' as TaiIconName);
      fixture.componentRef.setInput('size', 'lg');
      fixture.detectChanges();

      const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
      expect(svg.classList.contains('h-16')).toBe(true);
      expect(svg.classList.contains('w-16')).toBe(true);
    });
  });

  describe('decorative mode', () => {
    it('sets aria-hidden when decorative is true', () => {
      fixture.componentRef.setInput('name', 'chevron-up-down' as TaiIconName);
      fixture.componentRef.setInput('decorative', true);
      fixture.detectChanges();

      const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.getAttribute('aria-label')).toBeNull();
      expect(svg.getAttribute('role')).toBeNull();
    });

    it('sets aria-label and role when decorative is false', () => {
      fixture.componentRef.setInput('name', 'chevron-up-down' as TaiIconName);
      fixture.componentRef.setInput('decorative', false);
      fixture.componentRef.setInput('ariaLabel', 'Expand');
      fixture.detectChanges();

      const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
      expect(svg.getAttribute('aria-hidden')).toBeNull();
      expect(svg.getAttribute('aria-label')).toBe('Expand');
      expect(svg.getAttribute('role')).toBe('img');
    });
  });

  describe('SVG attributes', () => {
    it('applies fill and stroke attributes', () => {
      fixture.componentRef.setInput('name', 'search' as TaiIconName);
      fixture.detectChanges();

      const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
      expect(svg.getAttribute('fill')).toBe('none');
      expect(svg.getAttribute('stroke')).toBe('currentColor');
      expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    });
  });

  describe('security', () => {
    it('does not use innerHTML for icon paths', () => {
      const iconNames: TaiIconName[] = ['chevron-up', 'chevron-down', 'chevron-up-down', 'more-vertical', 'search', 'empty-state'];

      for (const name of iconNames) {
        fixture.componentRef.setInput('name', name);
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelector('[innerHTML]')).toBeNull();
      }
    });
  });
});
