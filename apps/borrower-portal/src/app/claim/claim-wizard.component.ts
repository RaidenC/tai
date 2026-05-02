import { Component, computed, inject } from '@angular/core';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { filter, map, startWith } from 'rxjs';
import { StepperComponent, StepperStep } from '@tai/ui-design-system';
import { selectStepValidity } from './+state';

type ClaimStepId =
  | 'borrower-info'
  | 'incident-details'
  | 'medical-providers'
  | 'review-sign';

interface ClaimWizardStep {
  id: ClaimStepId;
  path: ClaimStepId;
  label: string;
  validityKey: 'step1' | 'step2' | 'step3' | 'step4';
}

@Component({
  selector: 'bp-claim-wizard',
  standalone: true,
  imports: [StepperComponent, RouterModule],
  template: `
    <section class="mx-auto max-w-3xl p-8">
      <header class="mb-6">
        <h1 class="text-2xl font-semibold text-gray-900">Disability Claim</h1>
      </header>

      <tai-stepper
        class="mb-8 block"
        [steps]="steps()"
        [currentStepId]="currentStepId()"
        ariaLabel="Claim progress"
        testId="claim-stepper"
        (stepSelected)="onStepSelected($event)"
      />

      <main class="min-h-[400px]">
        <router-outlet></router-outlet>
      </main>
    </section>
  `,
})
export class ClaimWizardComponent {
  private readonly router = inject(Router);
  private readonly store = inject(Store);

  private readonly claimSteps: ClaimWizardStep[] = [
    { id: 'borrower-info', path: 'borrower-info', label: 'Borrower Info', validityKey: 'step1' },
    { id: 'incident-details', path: 'incident-details', label: 'Incident Details', validityKey: 'step2' },
    { id: 'medical-providers', path: 'medical-providers', label: 'Medical Providers', validityKey: 'step3' },
    { id: 'review-sign', path: 'review-sign', label: 'Review & Sign', validityKey: 'step4' },
  ];

  private readonly stepValidity = toSignal(this.store.select(selectStepValidity), {
    initialValue: {
      step1: false,
      step2: false,
      step3: false,
      step4: false,
    },
  });

  readonly currentStepId = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.currentRouteStepId()),
    ),
    { initialValue: 'borrower-info' },
  );

  readonly steps = computed<StepperStep[]>(() => {
    return this.claimSteps.map((step, index) => {
      const completed = this.stepValidity()[step.validityKey] === true;
      const canAccess = this.canAccessStep(index);

      return {
        id: step.id,
        label: step.label,
        status: completed ? 'completed' : canAccess ? 'not-started' : 'blocked',
        disabled: !canAccess,
      } satisfies StepperStep;
    });
  });

  onStepSelected(step: StepperStep): void {
    const claimStep = this.claimSteps.find((candidate) => candidate.id === step.id);
    if (!claimStep) {
      return;
    }

    const stepIndex = this.claimSteps.findIndex((candidate) => candidate.id === claimStep.id);
    if (!this.canAccessStep(stepIndex)) {
      return;
    }

    void this.router.navigate(['/claim', claimStep.path]).catch(() => undefined);
  }

  private canAccessStep(index: number): boolean {
    if (index < 0) {
      return false;
    }

    return this.claimSteps
      .slice(0, index)
      .every((priorStep) => this.stepValidity()[priorStep.validityKey] === true);
  }

  private currentRouteStepId(): string {
    try {
      const cleanUrl = this.router.url.split('?')[0].split('#')[0];
      const segments = cleanUrl.split('/').filter(Boolean);
      const lastSegment = segments.length > 0 ? segments[segments.length - 1] : '';
      return this.claimSteps.some((step) => step.id === lastSegment)
        ? lastSegment as ClaimStepId
        : 'borrower-info';
    } catch {
      return 'borrower-info';
    }
  }
}
