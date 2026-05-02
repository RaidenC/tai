# Design System Stepper Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the router-aware design-system wizard with a generic `tai-stepper` organism, while keeping borrower claim routing and workflow state in feature-owned code.

**Architecture:** `libs/ui/design-system` owns a reusable, strict-CSP-safe `StepperComponent` with explicit typed step state and no Angular router dependency. `currentStepId` is the only source of current-step state; `StepperStep.status` represents non-current statuses only. `apps/borrower-portal` owns the claim wizard wrapper that maps router URL and existing NgRx validity selectors into `StepperStep[]`, rejects blocked navigation before calling the router, and keeps `<router-outlet>` in the feature layer. The public `WizardComponent` export stays as a deprecated compatibility shim over `StepperComponent`.

**Tech Stack:** Angular 21 standalone components, Angular signal inputs/outputs, NgRx Store, Angular Router, Vitest Angular TestBed, Storybook Angular, Playwright E2E, Tailwind/static class strings, Nx.

---

## File Structure

- Create: `libs/ui/design-system/src/lib/organisms/stepper/stepper.component.ts`
  - Owns the generic `tai-stepper` API, status-to-class mapping, accessibility labels, and `stepSelected` output.
- Create: `libs/ui/design-system/src/lib/organisms/stepper/stepper.component.html`
  - Renders the semantic `<nav>`, ordered step list, state indicator, labels, and button behavior.
- Create: `libs/ui/design-system/src/lib/organisms/stepper/stepper.component.scss`
  - Holds reduced-motion support and responsive/connector rules that are easier to express in CSS than class strings.
- Create: `libs/ui/design-system/src/lib/organisms/stepper/stepper.component.spec.ts`
  - Unit tests for ARIA, status behavior, output emissions, CSP-safe rendering, and no router imports.
- Create: `libs/ui/design-system/src/lib/organisms/stepper/stepper.stories.ts`
  - Storybook coverage for default, current/completed, blocked, error, vertical, compact, mobile, and security stories.
- Modify: `libs/ui/design-system/src/index.ts`
  - Export the new stepper component and types.
- Create: `apps/borrower-portal/src/app/claim/claim-wizard.component.spec.ts`
  - Feature-wrapper tests proving claim route/state mapping and navigation intent.
- Modify: `apps/borrower-portal/src/app/claim/claim-wizard.component.ts`
  - Replace `WizardComponent` usage with `StepperComponent`; keep router-aware behavior in the feature component.
- Modify: `apps/borrower-portal-e2e/src/example.spec.ts`
  - Replace `.wizard-stepper` selector with role/test-id based stepper queries.
- Modify: `libs/ui/design-system/src/lib/organisms/wizard/wizard.component.ts`
  - Keep `WizardComponent` as a deprecated compatibility shim over `StepperComponent` for public API consumers.
- Modify: `libs/ui/design-system/src/lib/organisms/wizard/wizard.component.html`
  - Replace router-linked stepper markup with a `tai-stepper` composition while keeping projected wizard content.

---

### Task 1: Add Failing Stepper Unit Tests

**Files:**
- Create: `libs/ui/design-system/src/lib/organisms/stepper/stepper.component.spec.ts`

- [ ] **Step 1: Create the failing spec file**

Create `libs/ui/design-system/src/lib/organisms/stepper/stepper.component.spec.ts` with this content:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
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

  it('does not import Angular router primitives', () => {
    const source = readFileSync(new URL('./stepper.component.ts', import.meta.url), 'utf8');

    expect(source).not.toContain('@angular/router');
    expect(source).not.toContain('RouterModule');
    expect(source).not.toContain('ActivatedRoute');
    expect(source).not.toContain('routerLink');
  });
});
```

- [ ] **Step 2: Run the focused design-system test and verify it fails**

Run:

```bash
npx nx test design-system --include=src/lib/organisms/stepper/stepper.component.spec.ts --skip-nx-cache
```

Expected: FAIL because `./stepper.component` does not exist yet.

- [ ] **Step 3: Keep the failing test uncommitted until the implementation passes**

```bash
git status --short libs/ui/design-system/src/lib/organisms/stepper
```

Expected: the new failing spec is present in the worktree. Do not commit a red state.

---

### Task 2: Implement the Generic Stepper Organism

**Files:**
- Create: `libs/ui/design-system/src/lib/organisms/stepper/stepper.component.ts`
- Create: `libs/ui/design-system/src/lib/organisms/stepper/stepper.component.html`
- Create: `libs/ui/design-system/src/lib/organisms/stepper/stepper.component.scss`

- [ ] **Step 1: Add the Stepper component class**

Create `libs/ui/design-system/src/lib/organisms/stepper/stepper.component.ts`:

```typescript
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
      'tai-stepper__indicator inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold';
    const stateClasses: Record<StepperStepStatus, string> = {
      'not-started': ' border-gray-300 bg-white text-gray-600',
      completed: ' border-green-600 bg-green-600 text-white',
      blocked: ' border-gray-300 bg-gray-100 text-gray-500',
      error: ' border-red-600 bg-red-600 text-white',
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
```

- [ ] **Step 2: Add the Stepper template**

Create `libs/ui/design-system/src/lib/organisms/stepper/stepper.component.html`:

```html
<nav
  [class]="navClasses()"
  [attr.aria-label]="ariaLabel()"
  [attr.data-testid]="testId()"
>
  <ol [class]="listClasses()">
    @for (step of steps(); track step.id; let i = $index; let last = $last) {
      <li class="tai-stepper__item">
        <button
          type="button"
          [class]="stepButtonClasses(step)"
          [disabled]="isDisabled(step)"
          [attr.aria-current]="step.id === currentStepId() ? 'step' : null"
          [attr.aria-disabled]="isDisabled(step) ? 'true' : null"
          [attr.aria-label]="stepAriaLabel(step, i)"
          [attr.data-testid]="testId() + '-step-' + step.id"
          (click)="selectStep(step)"
        >
          <span
            [class]="indicatorClasses(step)"
            aria-hidden="true"
            [textContent]="step.status === 'completed' ? 'Done' : i + 1"
          ></span>
          <span class="tai-stepper__content min-w-0">
            <span class="tai-stepper__label block truncate font-semibold" [textContent]="step.label"></span>
            @if (step.description) {
              <span class="tai-stepper__description block truncate text-xs text-gray-500" [textContent]="step.description"></span>
            }
            <span
              class="tai-stepper__status mt-1 block text-xs font-medium text-gray-600"
              [attr.data-testid]="testId() + '-status-' + step.id"
              [textContent]="statusText(step)"
            ></span>
          </span>
        </button>

        @if (!last) {
          <span class="tai-stepper__connector" aria-hidden="true"></span>
        }
      </li>
    }
  </ol>
</nav>
```

- [ ] **Step 3: Add Stepper CSS**

Create `libs/ui/design-system/src/lib/organisms/stepper/stepper.component.scss`:

```scss
.tai-stepper {
  display: block;
}

.tai-stepper__list {
  display: flex;
  list-style: none;
  margin: 0;
  padding: 0;
}

.tai-stepper__list--horizontal {
  align-items: stretch;
  gap: 0.5rem;
}

.tai-stepper__list--vertical {
  flex-direction: column;
  gap: 0.25rem;
}

.tai-stepper__item {
  align-items: center;
  display: flex;
  flex: 1 1 0;
  min-width: 0;
}

.tai-stepper__list--vertical .tai-stepper__item {
  flex: none;
}

.tai-stepper__connector {
  background: rgb(229 231 235);
  display: block;
  flex: 1 1 1rem;
  height: 2px;
  margin-left: 0.5rem;
  min-width: 1rem;
}

.tai-stepper__list--vertical .tai-stepper__connector {
  display: none;
}

.tai-stepper__button {
  box-sizing: border-box;
}

.sr-only {
  border: 0;
  clip: rect(0, 0, 0, 0);
  height: 1px;
  margin: -1px;
  overflow: hidden;
  padding: 0;
  position: absolute;
  white-space: nowrap;
  width: 1px;
}

@media (max-width: 640px) {
  .tai-stepper__list--horizontal {
    flex-direction: column;
  }

  .tai-stepper__list--horizontal .tai-stepper__connector {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tai-stepper__button {
    transition-duration: 0ms;
  }
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```bash
npx nx test design-system --include=src/lib/organisms/stepper/stepper.component.spec.ts --skip-nx-cache
```

Expected: PASS for `StepperComponent`.

- [ ] **Step 5: Commit the generic Stepper implementation**

```bash
git add libs/ui/design-system/src/lib/organisms/stepper
git commit -m "feat: add generic design-system stepper"
```

---

### Task 3: Add Storybook Coverage and Public Export

**Files:**
- Create: `libs/ui/design-system/src/lib/organisms/stepper/stepper.stories.ts`
- Modify: `libs/ui/design-system/src/index.ts`

- [ ] **Step 1: Add Stepper stories**

Create `libs/ui/design-system/src/lib/organisms/stepper/stepper.stories.ts`:

```typescript
import { type Meta, type StoryObj } from '@storybook/angular';
import { expect, fn, userEvent, within } from '@storybook/test';
import { StepperComponent, StepperStep } from './stepper.component';

const baseSteps: StepperStep[] = [
  { id: 'borrower-info', label: 'Borrower Info', status: 'completed' },
  { id: 'incident-details', label: 'Incident Details', status: 'not-started' },
  { id: 'medical-providers', label: 'Medical Providers', status: 'not-started' },
  { id: 'review-sign', label: 'Review & Sign', status: 'not-started' },
];

const meta: Meta<StepperComponent> = {
  title: 'Organisms/Stepper',
  component: StepperComponent,
  tags: ['autodocs'],
  args: {
    steps: baseSteps,
    currentStepId: 'incident-details',
    orientation: 'horizontal',
    density: 'comfortable',
    ariaLabel: 'Claim progress',
    testId: 'story-stepper',
    stepSelected: fn(),
  },
  render: (args) => ({
    props: args,
    template: `
      <tai-stepper
        [steps]="steps"
        [currentStepId]="currentStepId"
        [orientation]="orientation"
        [density]="density"
        [ariaLabel]="ariaLabel"
        [testId]="testId"
        (stepSelected)="stepSelected($event)">
      </tai-stepper>
    `,
  }),
};

export default meta;
type Story = StoryObj<StepperComponent>;

export const Default: Story = {};

export const CompletedAndCurrent: Story = {
  args: {
    steps: baseSteps,
    currentStepId: 'incident-details',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('story-stepper-step-incident-details')).toHaveAttribute('aria-current', 'step');
    await expect(canvas.getByTestId('story-stepper-status-borrower-info')).toHaveTextContent('Completed');
  },
};

export const BlockedFutureSteps: Story = {
  args: {
    steps: [
      { id: 'borrower-info', label: 'Borrower Info', status: 'not-started' },
      { id: 'incident-details', label: 'Incident Details', status: 'blocked' },
      { id: 'medical-providers', label: 'Medical Providers', status: 'blocked' },
      { id: 'review-sign', label: 'Review & Sign', status: 'blocked' },
    ],
    currentStepId: 'borrower-info',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('story-stepper-step-medical-providers')).toBeDisabled();
  },
};

export const ErrorState: Story = {
  args: {
    steps: [
      { id: 'borrower-info', label: 'Borrower Info', status: 'completed' },
      { id: 'incident-details', label: 'Incident Details', status: 'error' },
      { id: 'medical-providers', label: 'Medical Providers', status: 'blocked' },
      { id: 'review-sign', label: 'Review & Sign', status: 'blocked' },
    ],
    currentStepId: 'incident-details',
  },
};

export const LongLabels: Story = {
  args: {
    steps: [
      { id: 'borrower-info', label: 'Borrower Information and Identity Confirmation', status: 'completed' },
      { id: 'incident-details', label: 'Incident Details and Disability Timeline', status: 'not-started' },
      { id: 'medical-providers', label: 'Medical Provider Contact and Treatment History', status: 'blocked' },
      { id: 'review-sign', label: 'Review, Attest, and Sign Claim Submission', status: 'blocked' },
    ],
    currentStepId: 'incident-details',
  },
};

export const Vertical: Story = {
  args: {
    orientation: 'vertical',
  },
};

export const Compact: Story = {
  args: {
    density: 'compact',
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

export const Security: Story = {
  args: {
    steps: [
      { id: 'safe', label: 'Safe Label', status: 'completed' },
      { id: 'xss', label: '<img src=x onerror=alert(1)>Injected', status: 'not-started' },
    ],
    currentStepId: 'xss',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const injected = canvas.getByTestId('story-stepper-step-xss');

    await expect(injected).toHaveTextContent('<img src=x onerror=alert(1)>Injected');
    await expect(injected.querySelector('img')).toBeNull();
  },
};

export const SelectableStep: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId('story-stepper-step-borrower-info'));
    await expect(args.stepSelected).toHaveBeenCalled();
  },
};

export const OpensWithKeyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const firstStep = canvas.getByTestId('story-stepper-step-borrower-info');

    firstStep.focus();
    await expect(firstStep).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(args.stepSelected).toHaveBeenCalled();
  },
};
```

- [ ] **Step 2: Export Stepper from the design-system public API**

Modify `libs/ui/design-system/src/index.ts` by adding this export near the other organism exports:

```typescript
export * from './lib/organisms/stepper/stepper.component';
```

Do not remove the existing wizard export in this task. Removal happens after borrower migration verifies no consumers remain.

- [ ] **Step 3: Run Storybook build**

Run:

```bash
CI=true npx nx build-storybook design-system --skip-nx-cache
```

Expected: PASS and produce `dist/storybook/design-system`.

- [ ] **Step 4: Run design-system tests**

Run:

```bash
npx nx test design-system --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 5: Run Storybook interaction tests**

Run:

```bash
npx nx test-storybook design-system --skip-nx-cache
```

Expected: PASS. If this target is not available, stop and verify the Nx Storybook inferred target before continuing; do not treat unrun Storybook interactions as proven.

- [ ] **Step 6: Commit stories and export**

```bash
git add libs/ui/design-system/src/lib/organisms/stepper/stepper.stories.ts libs/ui/design-system/src/index.ts
git commit -m "docs: add stepper stories and public export"
```

---

### Task 4: Migrate Borrower Claim Wizard Wrapper

**Files:**
- Create: `apps/borrower-portal/src/app/claim/claim-wizard.component.spec.ts`
- Modify: `apps/borrower-portal/src/app/claim/claim-wizard.component.ts`

- [ ] **Step 1: Add failing borrower wrapper tests**

Create `apps/borrower-portal/src/app/claim/claim-wizard.component.spec.ts`:

```typescript
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
```

- [ ] **Step 2: Run the focused borrower test and verify it fails**

Run:

```bash
npx nx test borrower-portal --include=src/app/claim/claim-wizard.component.spec.ts --skip-nx-cache
```

Expected: FAIL because `ClaimWizardComponent` still imports and renders `WizardComponent`, and it does not expose `currentStepId`, `steps`, or `onStepSelected`.

- [ ] **Step 3: Replace the borrower claim wizard wrapper**

Replace `apps/borrower-portal/src/app/claim/claim-wizard.component.ts` with:

```typescript
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
    { initialValue: this.currentRouteStepId() },
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
    const cleanUrl = this.router.url.split('?')[0].split('#')[0];
    const lastSegment = cleanUrl.split('/').filter(Boolean).at(-1);
    return this.claimSteps.some((step) => step.id === lastSegment)
      ? lastSegment as ClaimStepId
      : 'borrower-info';
  }
}
```

- [ ] **Step 4: Run the borrower wrapper test**

Run:

```bash
npx nx test borrower-portal --include=src/app/claim/claim-wizard.component.spec.ts --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 5: Run borrower portal unit tests**

Run:

```bash
npx nx test borrower-portal --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 6: Commit the borrower wrapper migration**

```bash
git add apps/borrower-portal/src/app/claim/claim-wizard.component.ts apps/borrower-portal/src/app/claim/claim-wizard.component.spec.ts
git commit -m "refactor: compose borrower wizard with generic stepper"
```

---

### Task 5: Update E2E Selectors and Keep Wizard Compatibility Shim

**Files:**
- Modify: `apps/borrower-portal-e2e/src/example.spec.ts`
- Modify: `libs/ui/design-system/src/lib/organisms/wizard/wizard.component.ts`
- Modify: `libs/ui/design-system/src/lib/organisms/wizard/wizard.component.html`

- [ ] **Step 1: Update borrower E2E selectors**

In `apps/borrower-portal-e2e/src/example.spec.ts`, replace the `stepper shows 4 steps` test with:

```typescript
test('stepper shows 4 steps', async ({ page }) => {
  await page.goto('/claim/borrower-info');

  const stepper = page.getByRole('navigation', { name: 'Claim progress' });
  await expect(stepper.getByRole('button', { name: /Borrower Info/ })).toBeVisible();
  await expect(stepper.getByRole('button', { name: /Incident Details/ })).toBeVisible();
  await expect(stepper.getByRole('button', { name: /Medical Providers/ })).toBeVisible();
  await expect(stepper.getByRole('button', { name: /Review & Sign/ })).toBeVisible();
  await expect(page.getByTestId('claim-stepper-step-borrower-info')).toHaveAttribute('aria-current', 'step');
  await expect(page.getByTestId('claim-stepper-step-medical-providers')).toBeDisabled();
});
```

- [ ] **Step 2: Refactor WizardComponent into a deprecated compatibility shim**

Replace `libs/ui/design-system/src/lib/organisms/wizard/wizard.component.ts` with:

```typescript
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
    const lastSegment = cleanUrl.split('/').filter(Boolean).at(-1);
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
```

Keep both public exports in `libs/ui/design-system/src/index.ts`:

```typescript
export * from './lib/organisms/stepper/stepper.component';
export * from './lib/organisms/wizard/wizard.component';
```

- [ ] **Step 3: Replace WizardComponent template with Stepper composition**

Replace `libs/ui/design-system/src/lib/organisms/wizard/wizard.component.html` with:

```html
<div class="wizard mx-auto max-w-3xl p-8">
  <header class="wizard-header mb-6">
    @if (title) {
      <h1 class="text-2xl font-semibold text-gray-900" [textContent]="title"></h1>
    }
  </header>

  <tai-stepper
    class="mb-8 block"
    [steps]="stepperSteps()"
    [currentStepId]="currentStepId()"
    ariaLabel="Wizard progress"
    testId="wizard-stepper"
    (stepSelected)="onStepSelected($event)"
  />

  <main class="wizard-content min-h-[400px]">
    <ng-content></ng-content>
  </main>
</div>
```

Expected: the compatibility wrapper no longer owns stepper markup directly; it delegates progress UI to `tai-stepper`.

- [ ] **Step 4: Verify borrower no longer consumes WizardComponent**

Run:

```bash
rg -n "WizardComponent|tai-wizard|wizardSteps|organisms/wizard" apps/borrower-portal apps/borrower-portal-e2e -g '!node_modules/**'
```

Expected: no matches. Matches inside `libs/ui/design-system/src/lib/organisms/wizard` are expected because the public compatibility shim remains.

- [ ] **Step 5: Run design-system and borrower checks**

First verify the inferred E2E target exists:

```bash
npx nx show project borrower-portal-e2e --json
```

Expected: output includes an `e2e` target inferred by `@nx/playwright/plugin`.

Run:

```bash
npx nx test design-system --skip-nx-cache
npx nx test borrower-portal --skip-nx-cache
npx nx e2e borrower-portal-e2e --skip-nx-cache
```

Expected: all PASS.

- [ ] **Step 6: Commit cleanup and E2E migration**

```bash
git add apps/borrower-portal-e2e/src/example.spec.ts libs/ui/design-system/src/index.ts
git add libs/ui/design-system/src/lib/organisms/wizard/wizard.component.ts libs/ui/design-system/src/lib/organisms/wizard/wizard.component.html
git commit -m "refactor: keep wizard shim over generic stepper"
```

---

### Task 6: Full Verification and Security/A11y Guardrails

**Files:**
- No code files expected.
- Use this task to catch integration, Storybook, CSP, and package build failures.

- [ ] **Step 1: Run design-system lint**

Run:

```bash
npx nx lint design-system --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 2: Run design-system unit tests**

Run:

```bash
npx nx test design-system --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 3: Run design-system package build**

Run:

```bash
npx nx build design-system --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 4: Run Storybook build**

Run:

```bash
CI=true npx nx build-storybook design-system --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 5: Run Storybook test runner when available**

Run:

```bash
npx nx test-storybook design-system --skip-nx-cache
```

Expected: PASS. If this target is not configured or cannot connect to a running Storybook server, record the exact failure as a blocker for claiming Storybook interaction/a11y coverage.

- [ ] **Step 6: Run borrower portal tests and E2E**

Run:

```bash
npx nx test borrower-portal --skip-nx-cache
npx nx e2e borrower-portal-e2e --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 7: Scan for banned CSP patterns in the new stepper**

Run:

```bash
rg -n "innerHTML|\\[innerHTML\\]|style=|\\[style\\]|DomSanitizer|bypassSecurityTrust|RouterModule|ActivatedRoute|routerLink|CdkStepper|MatStepper" libs/ui/design-system/src/lib/organisms/stepper
```

Expected: no matches.

- [ ] **Step 8: Commit verification notes if any docs changed**

If implementation changed documentation or verification notes, commit them:

```bash
git add docs
git commit -m "docs: record stepper verification"
```

If no docs changed, do not create an empty commit.

---

## Plan Self-Review

Spec coverage:

- Generic `StepperComponent`: Task 1 and Task 2.
- Typed route-free `StepperStep` model: Task 2.
- Storybook states: Task 3.
- Unit tests for ARIA, CSP, and no router dependency: Task 1.
- Keyboard activation coverage: Task 3 Storybook interaction tests.
- Borrower wrapper migration: Task 4.
- E2E selector preservation: Task 5.
- Wizard compatibility path: Task 5 keeps the deprecated public shim while migrating borrower portal away from it.
- Verification commands: Task 6.

Placeholder scan:

- No `TBD`, `TODO`, "implement later", or "similar to" placeholders.
- Each code-changing step includes exact file paths and concrete code.

Type consistency:

- `StepperStep`, `StepperStepStatus`, `StepperOrientation`, and `StepperDensity` are defined in Task 2 and used consistently by later tasks.
- Public selector is consistently `tai-stepper`.
- Output is consistently `stepSelected`.
- Borrower wrapper consistently maps `ClaimWizardStep` to `StepperStep`.
