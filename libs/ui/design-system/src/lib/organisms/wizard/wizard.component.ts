import { Component, Input, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router, RouterModule } from '@angular/router';
import { Subject, filter, takeUntil } from 'rxjs';
import { StepperComponent, StepperStep } from '../stepper/stepper.component';

export interface WizardStep {
  path: string;
  label: string;
}

/**
 * @deprecated Use StepperComponent in feature-owned router wrappers instead.
 * This shim preserves the public tai-wizard API for existing package consumers.
 */
@Component({
  selector: 'tai-wizard',
  standalone: true,
  imports: [CommonModule, RouterModule, StepperComponent],
  templateUrl: './wizard.component.html',
})
export class WizardComponent implements OnInit, OnDestroy {
  private readonly stepsSignal = signal<WizardStep[]>([]);

  @Input() set steps(value: WizardStep[]) {
    this.stepsSignal.set(value ?? []);
  }

  get steps(): WizardStep[] {
    return this.stepsSignal();
  }

  @Input() title?: string;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();
  private readonly routeUrl = signal(this.router.url);

  protected readonly currentStepId = computed(() => {
    const cleanUrl = this.routeUrl().split('?')[0].split('#')[0];
    const segments = cleanUrl.split('/').filter(Boolean);
    const lastSegment = segments.length > 0 ? segments[segments.length - 1] : undefined;
    const steps = this.stepsSignal();
    return steps.some((step) => step.path === lastSegment)
      ? lastSegment ?? steps[0]?.path ?? ''
      : steps[0]?.path ?? '';
  });

  protected readonly stepperSteps = computed<StepperStep[]>(() =>
    this.stepsSignal().map((step) => ({
      id: step.path,
      label: step.label,
      status: 'not-started',
    })),
  );

  ngOnInit(): void {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntil(this.destroy$),
      )
      .subscribe(() => this.routeUrl.set(this.router.url));

    if (this.steps.length === 0) {
      this.route.data.pipe(takeUntil(this.destroy$)).subscribe((data) => {
        if (data['wizardSteps']) {
          this.steps = data['wizardSteps'] as WizardStep[];
        }
        if (data['title'] && !this.title) {
          this.title = data['title'] as string;
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected onStepSelected(step: StepperStep): void {
    void this.router.navigate([step.id], { relativeTo: this.route }).catch(() => undefined);
  }
}
