import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type StepperOrientation = 'horizontal' | 'vertical';
export type StepperDensity = 'compact' | 'comfortable';
export type StepperStepStatus =
  | 'not-started'
  | 'completed'
  | 'blocked'
  | 'error';

export interface StepperStep {
  id: string;
  label: string;
  description?: string;
  status: StepperStepStatus;
  disabled?: boolean;
  ariaLabel?: string;
}

@Component({
  selector: 'tai-stepper',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stepper.component.html',
  styleUrl: './stepper.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepperComponent {
  readonly steps = input.required<StepperStep[]>();
  readonly currentStepId = input.required<string>();
  readonly orientation = input<StepperOrientation>('horizontal');
  readonly density = input<StepperDensity>('comfortable');
  readonly ariaLabel = input<string>('Progress');
  readonly testId = input<string>('stepper');

  readonly stepSelected = output<StepperStep>();

  protected readonly navClasses = computed(() => {
    const orientationClass =
      this.orientation() === 'vertical'
        ? ' tai-stepper--vertical'
        : ' tai-stepper--horizontal';
    const densityClass =
      this.density() === 'compact'
        ? ' tai-stepper--compact'
        : ' tai-stepper--comfortable';

    return `tai-stepper${orientationClass}${densityClass}`;
  });

  protected readonly listClasses = computed(() =>
    this.orientation() === 'vertical'
      ? 'tai-stepper__list tai-stepper__list--vertical'
      : 'tai-stepper__list tai-stepper__list--horizontal',
  );

  protected isDisabled(step: StepperStep): boolean {
    return step.disabled === true || step.status === 'blocked';
  }

  protected selectStep(step: StepperStep): void {
    if (this.isDisabled(step)) {
      return;
    }

    this.stepSelected.emit(step);
  }

  protected isCurrent(step: StepperStep): boolean {
    return step.id === this.currentStepId();
  }

  protected stepButtonClasses(step: StepperStep): string {
    const base =
      'tai-stepper__button inline-flex w-full min-w-0 items-center gap-3 rounded-md border-0 bg-transparent text-left outline-none transition-colors duration-200 focus-visible:ring-3 focus-visible:ring-blue-600/25 disabled:cursor-not-allowed disabled:opacity-60';
    const densityClass =
      this.density() === 'compact'
        ? ' min-h-10 px-2 py-2 text-sm'
        : ' min-h-11 px-3 py-3 text-sm';
    const stateClasses: Record<StepperStepStatus, string> = {
      'not-started': ' text-gray-700 hover:bg-gray-50',
      completed: ' text-gray-900 hover:bg-gray-50',
      blocked: ' text-gray-500',
      error: ' bg-red-50 text-red-900 hover:bg-red-100',
    };
    const currentClass = this.isCurrent(step) ? ' ring-2 ring-blue-600/35' : '';

    return `${base}${densityClass}${stateClasses[step.status]}${currentClass}`;
  }

  protected indicatorClasses(step: StepperStep): string {
    const base =
      'tai-stepper__indicator inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold';
    const stateClasses: Record<StepperStepStatus, string> = {
      'not-started': ' border-gray-300 bg-white text-gray-500',
      completed: ' border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-500/25',
      blocked: ' border-gray-200 bg-gray-100 text-gray-400',
      error: ' border-red-500 bg-red-500 text-white shadow-sm shadow-red-500/25',
    };

    const currentClass = this.isCurrent(step) ? ' ring-2 ring-blue-600 ring-offset-2' : '';

    return `${base}${stateClasses[step.status]}${currentClass}`;
  }

  protected statusText(step: StepperStep): string {
    const labels: Record<StepperStepStatus, string> = {
      'not-started': 'Not started',
      completed: 'Completed',
      blocked: 'Blocked',
      error: 'Needs attention',
    };

    return this.isCurrent(step)
      ? `Current step, ${labels[step.status].toLowerCase()}`
      : labels[step.status];
  }

  protected stepAriaLabel(step: StepperStep, index: number): string {
    return step.ariaLabel ?? `Step ${index + 1}: ${step.label}. ${this.statusText(step)}.`;
  }
}
