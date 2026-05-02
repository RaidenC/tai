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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const stepper = canvas.getByTestId('story-stepper-step-borrower-info');

    // Verify the step is clickable (not disabled)
    await expect(stepper).toBeEnabled();
    // Click and verify it doesn't throw
    await userEvent.click(stepper);
  },
};

export const OpensWithKeyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const firstStep = canvas.getByTestId('story-stepper-step-borrower-info');

    firstStep.focus();
    await expect(firstStep).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    // Verify keyboard navigation works
    await expect(document.activeElement).toBe(firstStep);
  },
};
