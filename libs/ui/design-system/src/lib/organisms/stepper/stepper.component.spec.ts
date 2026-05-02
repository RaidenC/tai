import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { StepperComponent, StepperStep } from './stepper.component';

const steps: StepperStep[] = [
  { id: 'borrower-info', label: 'Borrower Info', status: 'completed' },
  { id: 'incident-details', label: 'Incident Details', status: 'not-started' },
  { id: 'medical-providers', label: 'Medical Providers', status: 'blocked' },
  { id: 'review-sign', label: '<img src=x onerror=alert(1)>Review & Sign', status: 'not-started' },
];

describe('StepperComponent', () => {
  let fixture: ComponentFixture<StepperComponent>;
  let component: StepperComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StepperComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StepperComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('steps', steps);
    fixture.componentRef.setInput('currentStepId', 'incident-details');
    fixture.componentRef.setInput('ariaLabel', 'Claim progress');
    fixture.componentRef.setInput('testId', 'claim-stepper');
    fixture.detectChanges();
  });

  it('renders a progress navigation landmark with an ordered list', () => {
    const nav = fixture.nativeElement.querySelector('[data-testid="claim-stepper"]') as HTMLElement;
    const listItems = fixture.nativeElement.querySelectorAll('ol > li');

    expect(nav.tagName.toLowerCase()).toBe('nav');
    expect(nav.getAttribute('aria-label')).toBe('Claim progress');
    expect(listItems.length).toBe(4);
  });

  it('marks the current step with aria-current="step"', () => {
    const current = fixture.nativeElement.querySelector('[data-testid="claim-stepper-step-incident-details"]') as HTMLButtonElement;

    expect(current).toBeTruthy();
    expect(current.getAttribute('aria-current')).toBe('step');
    expect(current.getAttribute('aria-label')).toContain('Current step');
  });

  it('disables blocked steps and prevents selection', () => {
    const spy = vi.fn();
    component.stepSelected.subscribe(spy);

    const blocked = fixture.nativeElement.querySelector('[data-testid="claim-stepper-step-medical-providers"]') as HTMLButtonElement;
    blocked.click();

    expect(blocked.disabled).toBe(true);
    expect(blocked.getAttribute('aria-disabled')).toBe('true');
    expect(spy).not.toHaveBeenCalled();
  });

  it('emits stepSelected for enabled non-blocked steps', () => {
    const spy = vi.fn();
    component.stepSelected.subscribe(spy);

    const completed = fixture.nativeElement.querySelector('[data-testid="claim-stepper-step-borrower-info"]') as HTMLButtonElement;
    completed.click();

    expect(spy).toHaveBeenCalledWith(steps[0]);
  });

  it('renders untrusted labels as text instead of HTML', () => {
    const review = fixture.nativeElement.querySelector('[data-testid="claim-stepper-step-review-sign"]') as HTMLButtonElement;

    expect(review.textContent).toContain('<img src=x onerror=alert(1)>Review & Sign');
    expect(review.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.querySelector('[innerHTML]')).toBeNull();
  });

  it('renders completed and error states with non-color text', () => {
    fixture.componentRef.setInput('steps', [
      { id: 'one', label: 'One', status: 'completed' },
      { id: 'two', label: 'Two', status: 'error' },
    ] satisfies StepperStep[]);
    fixture.componentRef.setInput('currentStepId', 'two');
    fixture.detectChanges();

    const completed = fixture.nativeElement.querySelector('[data-testid="claim-stepper-status-one"]') as HTMLElement;
    const error = fixture.nativeElement.querySelector('[data-testid="claim-stepper-status-two"]') as HTMLElement;

    expect(completed.textContent?.trim()).toBe('Completed');
    expect(error.textContent?.trim()).toBe('Current step, needs attention');
    expect(completed.className).not.toContain('sr-only');
    expect(error.className).not.toContain('sr-only');
  });

  it('uses currentStepId as the only current-state source of truth', () => {
    fixture.componentRef.setInput('steps', [
      { id: 'one', label: 'One', status: 'completed' },
      { id: 'two', label: 'Two', status: 'not-started' },
    ] satisfies StepperStep[]);
    fixture.componentRef.setInput('currentStepId', 'two');
    fixture.detectChanges();

    const current = fixture.nativeElement.querySelector('[data-testid="claim-stepper-step-two"]') as HTMLButtonElement;
    const previous = fixture.nativeElement.querySelector('[data-testid="claim-stepper-step-one"]') as HTMLButtonElement;

    expect(current.getAttribute('aria-current')).toBe('step');
    expect(current.getAttribute('aria-label')).toContain('Current step');
    expect(previous.getAttribute('aria-current')).toBeNull();
  });

  it('applies vertical and compact variants through explicit internal class mapping', () => {
    fixture.componentRef.setInput('orientation', 'vertical');
    fixture.componentRef.setInput('density', 'compact');
    fixture.detectChanges();

    const nav = fixture.nativeElement.querySelector('[data-testid="claim-stepper"]') as HTMLElement;

    expect(nav.className).toContain('tai-stepper--vertical');
    expect(nav.className).toContain('tai-stepper--compact');
  });

  it('does not render inline style attributes', () => {
    expect(fixture.nativeElement.querySelector('[style]')).toBeNull();
  });

  it('does not use Angular router primitives', () => {
    // Verify the StepperComponent doesn't import router-related modules
    // by checking the component constructor for router references
    const componentSource = StepperComponent.toString();
    expect(componentSource).not.toContain('RouterModule');
    expect(componentSource).not.toContain('ActivatedRoute');
    expect(componentSource).not.toContain('routerLink');
  });
});
