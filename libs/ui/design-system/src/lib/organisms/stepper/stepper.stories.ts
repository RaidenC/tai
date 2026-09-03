import { type Meta, type StoryObj } from '@storybook/angular';
import { expect, fn, userEvent, within } from '@storybook/test';
import { StepperComponent, StepperStep } from './stepper.component';

const baseSteps: StepperStep[] = [
  { id: 'borrower-info', label: 'Borrower Info', status: 'completed' },
  { id: 'incident-details', label: 'Incident Details', status: 'not-started' },
  {
    id: 'medical-providers',
    label: 'Medical Providers',
    status: 'not-started',
  },
  { id: 'review-sign', label: 'Review & Sign', status: 'not-started' },
];

const stepSelectedSpy = fn<(step: StepperStep) => void>();

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
    stepSelected: stepSelectedSpy,
  },
  render: (args) => ({
    props: { ...args, stepSelected: stepSelectedSpy },
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

Default.play = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const navigation = canvas.getByRole('navigation', { name: 'Claim progress' });

  await expect(navigation).toBeVisible();
  await expect(canvas.getByRole('list')).toBeVisible();
  await expect(canvas.getAllByRole('listitem')).toHaveLength(4);
  await expect(canvas.getAllByRole('button')).toHaveLength(4);
};

export const CompletedAndCurrent: Story = {
  args: {
    steps: baseSteps,
    currentStepId: 'incident-details',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByTestId('story-stepper-step-incident-details'),
    ).toHaveAttribute('aria-current', 'step');
    await expect(
      canvas.getByTestId('story-stepper-status-borrower-info'),
    ).toHaveTextContent('Completed');
  },
};

export const BlockedFutureSteps: Story = {
  args: {
    steps: [
      { id: 'borrower-info', label: 'Borrower Info', status: 'not-started' },
      { id: 'incident-details', label: 'Incident Details', status: 'blocked' },
      {
        id: 'medical-providers',
        label: 'Medical Providers',
        status: 'blocked',
      },
      { id: 'review-sign', label: 'Review & Sign', status: 'blocked' },
    ],
    currentStepId: 'borrower-info',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const blocked = canvas.getByRole('button', { name: /Medical Providers/ });

    stepSelectedSpy.mockClear();
    await expect(blocked).toBeDisabled();
    await expect(blocked).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(blocked);
    await expect(stepSelectedSpy).not.toHaveBeenCalled();
  },
};

export const ErrorState: Story = {
  args: {
    steps: [
      { id: 'borrower-info', label: 'Borrower Info', status: 'completed' },
      { id: 'incident-details', label: 'Incident Details', status: 'error' },
      {
        id: 'medical-providers',
        label: 'Medical Providers',
        status: 'blocked',
      },
      { id: 'review-sign', label: 'Review & Sign', status: 'blocked' },
    ],
    currentStepId: 'incident-details',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const current = canvas.getByRole('button', { name: /Incident Details/ });
    const currentStatus = canvas.getByTestId(
      'story-stepper-status-incident-details',
    );

    await expect(current).toHaveAttribute('aria-current', 'step');
    await expect(currentStatus).toHaveTextContent(
      'Current step, needs attention',
    );
    await expect(
      canvas.getByTestId('story-stepper-status-medical-providers'),
    ).toHaveTextContent('Blocked');
  },
};

export const LongLabels: Story = {
  args: {
    steps: [
      {
        id: 'borrower-info',
        label: 'Borrower Information and Identity Confirmation',
        status: 'completed',
      },
      {
        id: 'incident-details',
        label: 'Incident Details and Disability Timeline',
        status: 'not-started',
      },
      {
        id: 'medical-providers',
        label: 'Medical Provider Contact and Treatment History',
        status: 'blocked',
      },
      {
        id: 'review-sign',
        label: 'Review, Attest, and Sign Claim Submission',
        status: 'blocked',
      },
    ],
    currentStepId: 'incident-details',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByText('Borrower Information and Identity Confirmation'),
    ).toBeVisible();
    await expect(
      canvas.getByText('Incident Details and Disability Timeline'),
    ).toBeVisible();
    await expect(
      canvas.getByText('Medical Provider Contact and Treatment History'),
    ).toBeVisible();
    await expect(
      canvas.getByText('Review, Attest, and Sign Claim Submission'),
    ).toBeVisible();
    await expect(canvas.getAllByRole('button')).toHaveLength(4);
  },
};

export const Vertical: Story = {
  args: {
    orientation: 'vertical',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('navigation')).toHaveClass(
      'tai-stepper--vertical',
    );
    await expect(canvas.getByRole('list')).toHaveClass(
      'tai-stepper__list--vertical',
    );
  },
};

export const Compact: Story = {
  args: {
    density: 'compact',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('navigation')).toHaveClass(
      'tai-stepper--compact',
    );
    await expect(
      canvas.getByRole('button', { name: /Borrower Info/ }),
    ).toHaveClass('min-h-10');
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('navigation')).toBeVisible();
    await expect(canvas.getAllByRole('button')).toHaveLength(4);
  },
};

export const Security: Story = {
  args: {
    steps: [
      { id: 'safe', label: 'Safe Label', status: 'completed' },
      {
        id: 'xss',
        label: '<img src=x onerror=alert(1)>Injected',
        status: 'not-started',
      },
    ],
    currentStepId: 'xss',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const injected = canvas.getByTestId('story-stepper-step-xss');

    await expect(injected).toHaveTextContent(
      '<img src=x onerror=alert(1)>Injected',
    );
    await expect(injected.querySelector('img')).toBeNull();
  },
};

export const SelectableStep: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const stepper = canvas.getByRole('button', {
      name: /Step 1: Borrower Info/,
    });

    stepSelectedSpy.mockClear();
    await expect(stepper).toBeEnabled();
    await userEvent.click(stepper);
    await expect(stepSelectedSpy).toHaveBeenCalledWith(baseSteps[0]);
  },
};

export const OpensWithKeyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const firstStep = canvas.getByRole('button', {
      name: /Step 1: Borrower Info/,
    });

    stepSelectedSpy.mockClear();
    (firstStep as HTMLElement).focus();
    await expect(firstStep).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(stepSelectedSpy).toHaveBeenCalledWith(baseSteps[0]);
    await expect(document.activeElement).toBe(firstStep);
  },
};
