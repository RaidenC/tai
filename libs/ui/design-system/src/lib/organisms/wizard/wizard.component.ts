import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

/**
 * Wizard step configuration
 */
export interface WizardStep {
  /** Route path for this step */
  path: string;
  /** Display label for this step */
  label: string;
}

/**
 * Wizard Component - Generic Stepper UI
 *
 * A pure presentation component that displays a multi-step wizard
 * with navigation. Step components are rendered via router-outlet.
 *
 * Usage with router (steps passed via route data):
 * ```typescript
 * // app.routes.ts
 * {
 *   path: 'claim',
 *   component: WizardComponent,
 *   data: {
 *     wizardSteps: [
 *       { path: 'step1', label: 'Step One' },
 *       { path: 'step2', label: 'Step Two' },
 *     ]
 *   },
 *   children: [...]
 * }
 * ```
 *
 * Or standalone (steps passed via input):
 * ```html
 * <tai-wizard [steps]="steps" title="My Wizard">
 *   <router-outlet></router-outlet>
 * </tai-wizard>
 * ```
 */
@Component({
  selector: 'tai-wizard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './wizard.component.html',
})
export class WizardComponent implements OnInit, OnDestroy {
  /** Array of wizard steps with path and label */
  @Input() steps: WizardStep[] = [];

  /** Optional title displayed at the top */
  @Input() title?: string;

  private route = inject(ActivatedRoute);
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    // If steps not provided via @Input(), subscribe to route data
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
}
