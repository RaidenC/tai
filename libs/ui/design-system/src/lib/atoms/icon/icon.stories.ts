import type { Meta, StoryObj } from '@storybook/angular';
import { expect, within } from '@storybook/test';
import { IconComponent } from './icon.component';

const getSvg = (canvasElement: HTMLElement): SVGElement => {
  const svg = canvasElement.querySelector('svg');

  if (!svg) {
    throw new Error('Expected the icon to render an SVG element');
  }

  return svg;
};

const meta: Meta<IconComponent> = {
  title: 'Atoms/Icon',
  component: IconComponent,
  args: {
    name: 'more-vertical',
    size: 'md',
    decorative: true,
  },
};

export default meta;
type Story = StoryObj<IconComponent>;

export const MoreVertical: Story = {
  play: async ({ canvasElement }) => {
    const svg = getSvg(canvasElement);

    await expect(svg).toHaveClass('tai-icon');
    await expect(svg).toHaveClass('h-5');
    await expect(svg).toHaveClass('w-5');
    await expect(svg).toHaveAttribute('fill', 'none');
    await expect(svg).toHaveAttribute('stroke', 'currentColor');
    await expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    await expect(svg).toHaveAttribute('aria-hidden', 'true');
    await expect(svg).not.toHaveAttribute('aria-label');
    await expect(svg).not.toHaveAttribute('role');
    await expect(svg.querySelectorAll('circle').length).toBe(3);
  },
};

export const Sort: Story = {
  args: {
    name: 'chevron-up-down',
    decorative: false,
    ariaLabel: 'Sort',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const icon = canvas.getByRole('img', { name: 'Sort' });

    await expect(icon).toHaveAttribute('role', 'img');
    await expect(icon).toHaveAttribute('aria-label', 'Sort');
    await expect(icon).not.toHaveAttribute('aria-hidden');
    await expect(icon.querySelector('path')).toBeTruthy();
  },
};

export const ChevronUp: Story = {
  args: {
    name: 'chevron-up',
  },
  play: async ({ canvasElement }) => {
    const svg = getSvg(canvasElement);

    await expect(svg.querySelector('path')).toBeTruthy();
    await expect(svg.querySelectorAll('circle').length).toBe(0);
  },
};

export const ChevronDown: Story = {
  args: {
    name: 'chevron-down',
  },
  play: async ({ canvasElement }) => {
    const svg = getSvg(canvasElement);

    await expect(svg.querySelector('path')).toBeTruthy();
    await expect(svg.querySelectorAll('circle').length).toBe(0);
  },
};

export const Search: Story = {
  args: {
    name: 'search',
  },
  play: async ({ canvasElement }) => {
    const svg = getSvg(canvasElement);

    await expect(svg.querySelector('path')).toBeTruthy();
  },
};

export const EmptyState: Story = {
  args: {
    name: 'empty-state',
  },
  play: async ({ canvasElement }) => {
    const svg = getSvg(canvasElement);

    await expect(svg.querySelector('path')).toBeTruthy();
  },
};

export const Small: Story = {
  args: {
    name: 'search',
    size: 'sm',
  },
  play: async ({ canvasElement }) => {
    const svg = getSvg(canvasElement);

    await expect(svg).toHaveClass('h-4');
    await expect(svg).toHaveClass('w-4');
  },
};

export const Large: Story = {
  args: {
    name: 'empty-state',
    size: 'lg',
  },
  play: async ({ canvasElement }) => {
    const svg = getSvg(canvasElement);

    await expect(svg).toHaveClass('h-16');
    await expect(svg).toHaveClass('w-16');
  },
};
