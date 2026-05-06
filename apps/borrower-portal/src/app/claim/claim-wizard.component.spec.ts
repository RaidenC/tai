import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { Router } from '@angular/router';
import { ClaimWizardComponent } from './claim-wizard.component';
import { selectStepValidity } from './+state';

describe('ClaimWizardComponent', () => {
  let fixture: ComponentFixture<ClaimWizardComponent>;
  let component: ClaimWizardComponent;
  let store: MockStore;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClaimWizardComponent, RouterTestingModule.withRoutes([])],
      providers: [
        provideMockStore({
          selectors: [
            {
              selector: selectStepValidity,
              value: {
                step1: true,
                step2: false,
                step3: false,
                step4: false,
              },
            },
          ],
        }),
      ],
    }).compileComponents();

    store = TestBed.inject(MockStore);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    Object.defineProperty(router, 'url', {
      configurable: true,
      get: () => '/claim/incident-details',
    });

    fixture = TestBed.createComponent(ClaimWizardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the generic design-system stepper', () => {
    const stepper = fixture.nativeElement.querySelector('tai-stepper');

    expect(stepper).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Borrower Info');
    expect(fixture.nativeElement.textContent).toContain('Incident Details');
    expect(fixture.nativeElement.textContent).toContain('Medical Providers');
    expect(fixture.nativeElement.textContent).toContain('Review & Sign');
  });

  it('derives current step id from the route URL', () => {
    expect(component.currentStepId()).toBe('incident-details');
  });

  it('maps validity selectors to completed, not-started, and blocked step states', () => {
    const steps = component.steps();

    expect(steps.find((step) => step.id === 'borrower-info')?.status).toBe('completed');
    expect(steps.find((step) => step.id === 'incident-details')?.status).toBe('not-started');
    expect(steps.find((step) => step.id === 'medical-providers')?.status).toBe('blocked');
    expect(steps.find((step) => step.id === 'review-sign')?.status).toBe('blocked');
  });

  it('navigates when an enabled step is selected', () => {
    component.onStepSelected({ id: 'borrower-info', label: 'Borrower Info', status: 'completed' });

    expect(router.navigate).toHaveBeenCalledWith(['/claim', 'borrower-info']);
  });

  it('does not navigate when a blocked future step is selected directly', () => {
    component.onStepSelected({ id: 'medical-providers', label: 'Medical Providers', status: 'blocked' });

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('updates step status when store validity changes', () => {
    store.overrideSelector(selectStepValidity, {
      step1: true,
      step2: true,
      step3: false,
      step4: false,
    });
    store.refreshState();
    fixture.detectChanges();

    expect(component.steps().find((step) => step.id === 'medical-providers')?.status).toBe('not-started');
  });

  it('uses document validity for the review step completion state', () => {
    store.overrideSelector(selectStepValidity, {
      step1: true,
      step2: true,
      step3: true,
      step4: true,
    });
    store.refreshState();
    fixture.detectChanges();

    expect(component.steps().find((step) => step.id === 'review-sign')?.status).toBe('completed');
  });
});
