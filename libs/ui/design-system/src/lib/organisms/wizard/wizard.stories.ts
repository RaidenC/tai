import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  type Meta,
  type StoryObj,
  applicationConfig,
  moduleMetadata,
} from '@storybook/angular';
import { expect, fn, userEvent, within } from '@storybook/test';
import { EMPTY, of } from 'rxjs';
import { WizardComponent, WizardStep } from './wizard.component';

const wizardSteps: WizardStep[] = [
  { path: 'details', label: 'Claim details' },
  { path: 'documents', label: 'Supporting documents' },
  { path: 'review', label: 'Review and submit' },
];

const navigateSpy = fn<
  (
    commands: unknown[],
    extras: { relativeTo: ActivatedRoute },
  ) => Promise<boolean>
>(() => Promise.resolve(true));

const routerStub = {
  url: '/details',
  events: EMPTY,
  navigate: navigateSpy,
};

const routeStub = {
  data: of({}),
};

const meta: Meta<WizardComponent> = {
  title: 'Organisms/Wizard',
  component: WizardComponent,
  tags: ['autodocs'],
  decorators: [
    applicationConfig({
      providers: [
        { provide: Router, useValue: routerStub },
        { provide: ActivatedRoute, useValue: routeStub },
      ],
    }),
    moduleMetadata({
      imports: [CommonModule, WizardComponent],
    }),
  ],
  args: {
    steps: wizardSteps,
    title: 'Submit a claim',
  },
  render: (args) => ({
    props: { ...args },
    template: `
      <tai-wizard [steps]="steps" [title]="title">
        <section aria-label="Current wizard content">
          <p>Complete each step to submit your claim.</p>
        </section>
      </tai-wizard>
    `,
  }),
};

export default meta;
type Story = StoryObj<WizardComponent>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole('heading', { name: 'Submit a claim' }),
    ).toBeVisible();
    await expect(
      canvas.getByRole('navigation', { name: 'Wizard progress' }),
    ).toBeVisible();
    await expect(canvas.getAllByRole('button')).toHaveLength(3);
    await expect(
      canvas.getByRole('button', { name: /Claim details/ }),
    ).toHaveAttribute('aria-current', 'step');
    await expect(
      canvas.getByRole('region', { name: 'Current wizard content' }),
    ).toHaveTextContent('Complete each step to submit your claim.');
  },
};

export const SelectsStepAndNavigates: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    navigateSpy.mockClear();

    await userEvent.click(
      canvas.getByRole('button', { name: /Supporting documents/ }),
    );

    await expect(navigateSpy).toHaveBeenCalledWith(
      ['documents'],
      expect.objectContaining({ relativeTo: expect.anything() }),
    );
  },
};

export const WithoutTitle: Story = {
  args: {
    title: undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.queryByRole('heading')).not.toBeInTheDocument();
    await expect(canvas.getByRole('navigation')).toBeVisible();
  },
};

export const EmptySteps: Story = {
  args: {
    steps: [],
    title: 'Claim wizard',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole('heading', { name: 'Claim wizard' }),
    ).toBeVisible();
    await expect(canvas.getByRole('navigation')).toBeVisible();
    await expect(canvas.queryAllByRole('button')).toHaveLength(0);
    await expect(
      canvas.getByRole('region', { name: 'Current wizard content' }),
    ).toBeVisible();
  },
};

export const RouteDataFallback: Story = {
  args: {
    steps: [],
    title: undefined,
  },
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            data: of({
              title: 'Route-configured wizard',
              wizardSteps,
            }),
          },
        },
      ],
    }),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole('heading', { name: 'Route-configured wizard' }),
    ).toBeVisible();
    await expect(canvas.getAllByRole('button')).toHaveLength(3);
    await expect(
      canvas.getByRole('button', { name: /Claim details/ }),
    ).toHaveAttribute('aria-current', 'step');
  },
};

export const SafeTextRendering: Story = {
  args: {
    title: '<img src=x onerror=alert(1)>Unsafe title',
    steps: [
      { path: 'details', label: '<img src=x onerror=alert(1)>Unsafe step' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole('heading', {
        name: '<img src=x onerror=alert(1)>Unsafe title',
      }),
    ).toBeVisible();
    await expect(
      canvas.getByRole('button', {
        name: /<img src=x onerror=alert\(1\)>Unsafe step/,
      }),
    ).toBeVisible();
    await expect(canvasElement.querySelector('img')).toBeNull();
  },
};
