import { type Meta, type StoryObj } from '@storybook/angular';
import {
  expect,
  fn,
  type Mock,
  userEvent,
  waitFor,
  within,
} from '@storybook/test';
import {
  DropdownMenuComponent,
  type DropdownDensity,
  type DropdownMenuItem,
  type DropdownMobileMode,
  type DropdownPlacement,
} from './dropdown-menu.component';
import type { TaiIconName } from '../../atoms/icon/icon.component';

const literalHtmlLabel = '<img src=x onerror=alert(1)>Logout';
const items: DropdownMenuItem[] = [
  { id: 'profile', label: 'My Profile' },
  { id: 'settings', label: 'Account Settings' },
  { id: 'disabled', label: 'Disabled Action', disabled: true },
  { id: 'logout', label: literalHtmlLabel, destructive: true },
];

type DropdownEventSpies = {
  itemSelected: Mock<(item: DropdownMenuItem) => void>;
  opened: Mock<() => void>;
  closed: Mock<() => void>;
};

type DropdownMenuStoryArgs = Partial<{
  items: DropdownMenuItem[];
  triggerLabel: string;
  triggerIcon: TaiIconName | null;
  ariaLabel: string;
  placement: DropdownPlacement;
  mobileMode: DropdownMobileMode;
  density: DropdownDensity;
  testId: string;
}>;

const createSpies = (): DropdownEventSpies => ({
  itemSelected: fn<(item: DropdownMenuItem) => void>(),
  opened: fn<() => void>(),
  closed: fn<() => void>(),
});

const renderWithSpies = (spies: DropdownEventSpies) =>
  (args: DropdownMenuStoryArgs) => ({
    props: { ...args, ...spies },
    template: `
      <div class="flex min-h-[28rem] w-full items-center justify-center p-8">
        <tai-dropdown-menu
          [items]="items"
          [triggerLabel]="triggerLabel"
          [triggerIcon]="triggerIcon"
          [ariaLabel]="ariaLabel"
          [placement]="placement"
          [mobileMode]="mobileMode"
          [density]="density"
          [testId]="testId"
          (itemSelected)="itemSelected($event)"
          (opened)="opened()"
          (closed)="closed()">
        </tai-dropdown-menu>
      </div>
    `,
  });

const meta: Meta<DropdownMenuComponent> = {
  title: 'Molecules/DropdownMenu',
  component: DropdownMenuComponent,
  tags: ['autodocs'],
  args: {
    items,
    triggerLabel: 'Actions',
    ariaLabel: 'Actions',
    placement: 'bottom-end',
    mobileMode: 'sheet',
    density: 'comfortable',
    testId: 'story-dropdown',
  },
  render: (args) => renderWithSpies(createSpies())(args),
};

export default meta;
type Story = StoryObj<DropdownMenuComponent>;

const defaultSpies = createSpies();
export const Default: Story = {
  render: renderWithSpies(defaultSpies),
  play: async ({ canvasElement }) => {
    defaultSpies.opened.mockClear();
    defaultSpies.closed.mockClear();

    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Actions' });

    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    await waitFor(() => expect(canvas.getByRole('menu')).toBeInTheDocument());
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(defaultSpies.opened).toHaveBeenCalledTimes(1);

    await userEvent.click(trigger);
    await waitFor(() =>
      expect(canvas.queryByRole('menu')).not.toBeInTheDocument(),
    );
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(defaultSpies.closed).toHaveBeenCalledTimes(1);
  },
};

const compactSpies = createSpies();
export const Compact: Story = {
  args: {
    density: 'compact',
    triggerIcon: 'more-vertical',
    triggerLabel: '',
  },
  render: renderWithSpies(compactSpies),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Actions' }));
    const menu = await waitFor(() => canvas.getByRole('menu'));
    const item = canvas.getByRole('menuitem', { name: 'My Profile' });

    await expect(menu).toHaveAttribute('data-density', 'compact');
    await expect(menu).toHaveClass('data-[density=compact]');
    await expect(item).toHaveClass('min-h-10');
    await expect(item).toHaveClass('px-3');
  },
};

const selectionSpies = createSpies();
export const Selection: Story = {
  render: renderWithSpies(selectionSpies),
  play: async ({ canvasElement }) => {
    selectionSpies.itemSelected.mockClear();

    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Actions' });
    await userEvent.click(trigger);
    await waitFor(() => expect(canvas.getByRole('menu')).toBeInTheDocument());

    const literalLabel = canvas.getByRole('menuitem', { name: literalHtmlLabel });
    await expect(literalLabel).toHaveTextContent(literalHtmlLabel);
    await expect(literalLabel.querySelector('img')).not.toBeInTheDocument();

    await userEvent.click(canvas.getByRole('menuitem', { name: 'My Profile' }));
    await expect(selectionSpies.itemSelected).toHaveBeenCalledWith(items[0]);
    await waitFor(() =>
      expect(canvas.queryByRole('menu')).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

const arrowUpSpies = createSpies();
export const OpensWithArrowUp: Story = {
  render: renderWithSpies(arrowUpSpies),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Actions' });

    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.tab();
    await expect(trigger).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    await waitFor(() =>
      expect(canvas.getByRole('menu')).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(canvas.getByRole('menuitem', { name: literalHtmlLabel })).toHaveFocus(),
    );

    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(canvas.queryByRole('menu')).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

const disabledSpies = createSpies();
export const DisabledSelection: Story = {
  render: renderWithSpies(disabledSpies),
  play: async ({ canvasElement }) => {
    disabledSpies.itemSelected.mockClear();

    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Actions' }));
    await waitFor(() => expect(canvas.getByRole('menu')).toBeInTheDocument());

    const disabledItem = canvas.getByRole('menuitem', { name: 'Disabled Action' });
    await expect(disabledItem).toBeDisabled();
    await userEvent.click(disabledItem);
    await expect(disabledSpies.itemSelected).not.toHaveBeenCalled();
    await expect(canvas.getByRole('menu')).toBeInTheDocument();
  },
};

const escapeSpies = createSpies();
export const EscapeRestoresFocus: Story = {
  render: renderWithSpies(escapeSpies),
  play: async ({ canvasElement }) => {
    escapeSpies.closed.mockClear();

    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Actions' });
    await userEvent.click(trigger);
    await waitFor(() => canvas.getByRole('menu'));
    await userEvent.keyboard('{Escape}');

    await waitFor(() =>
      expect(canvas.queryByRole('menu')).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
    await expect(escapeSpies.closed).toHaveBeenCalledTimes(1);
  },
};

const outsideClickSpies = createSpies();
export const OutsideClickCloses: Story = {
  render: renderWithSpies(outsideClickSpies),
  play: async ({ canvasElement }) => {
    outsideClickSpies.closed.mockClear();

    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Actions' }));
    await waitFor(() => expect(canvas.getByRole('menu')).toBeInTheDocument());
    await userEvent.click(document.body);

    await waitFor(() =>
      expect(canvas.queryByRole('menu')).not.toBeInTheDocument(),
    );
    await expect(outsideClickSpies.closed).toHaveBeenCalledTimes(1);
  },
};

const keyboardSpies = createSpies();
export const KeyboardNavigation: Story = {
  render: renderWithSpies(keyboardSpies),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Actions' });
    await userEvent.click(trigger);
    await waitFor(() =>
      expect(canvas.getByRole('menuitem', { name: 'My Profile' })).toHaveFocus(),
    );

    await userEvent.keyboard('{End}');
    await expect(
      canvas.getByRole('menuitem', { name: literalHtmlLabel }),
    ).toHaveFocus();

    await userEvent.keyboard('{Home}');
    await expect(canvas.getByRole('menuitem', { name: 'My Profile' })).toHaveFocus();

    await userEvent.keyboard('{ArrowDown}');
    await expect(
      canvas.getByRole('menuitem', { name: 'Account Settings' }),
    ).toHaveFocus();

    await userEvent.keyboard('{ArrowUp}');
    await expect(canvas.getByRole('menuitem', { name: 'My Profile' })).toHaveFocus();
  },
};

const keyboardOpenSpies = createSpies();
export const OpensWithKeyboard: Story = {
  render: renderWithSpies(keyboardOpenSpies),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Actions' });

    await userEvent.tab();
    await expect(trigger).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() =>
      expect(canvas.getByRole('menuitem', { name: 'My Profile' })).toHaveFocus(),
    );

    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(canvas.queryByRole('menu')).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

const placementStories = {
  bottomStart: {
    placement: 'bottom-start',
    classes: ['left-0', 'right-auto', 'top-full', 'mt-2'],
  },
  bottomEnd: {
    placement: 'bottom-end',
    classes: ['right-0', 'left-auto', 'top-full', 'mt-2'],
  },
  topStart: {
    placement: 'top-start',
    classes: ['left-0', 'right-auto', 'bottom-full', 'mb-2'],
  },
  topEnd: {
    placement: 'top-end',
    classes: ['right-0', 'left-auto', 'bottom-full', 'mb-2'],
  },
} as const;

const placementPlay = async (
  canvasElement: HTMLElement,
  classes: readonly string[],
) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'Actions' }));
  const menu = await waitFor(() => canvas.getByRole('menu'));
  for (const className of classes) {
    await expect(menu).toHaveClass(className);
  }
};

export const PlacementBottomStart: Story = {
  args: { placement: placementStories.bottomStart.placement },
  render: renderWithSpies(createSpies()),
  play: ({ canvasElement }) =>
    placementPlay(canvasElement, placementStories.bottomStart.classes),
};

export const PlacementBottomEnd: Story = {
  args: { placement: placementStories.bottomEnd.placement },
  render: renderWithSpies(createSpies()),
  play: ({ canvasElement }) =>
    placementPlay(canvasElement, placementStories.bottomEnd.classes),
};

export const PlacementTopStart: Story = {
  args: { placement: placementStories.topStart.placement },
  render: renderWithSpies(createSpies()),
  play: ({ canvasElement }) =>
    placementPlay(canvasElement, placementStories.topStart.classes),
};

export const PlacementTopEnd: Story = {
  args: { placement: placementStories.topEnd.placement },
  render: renderWithSpies(createSpies()),
  play: ({ canvasElement }) =>
    placementPlay(canvasElement, placementStories.topEnd.classes),
};

const mobileSheetSpies = createSpies();
export const MobileSheet: Story = {
  args: { mobileMode: 'sheet' },
  render: renderWithSpies(mobileSheetSpies),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Actions' }));
    const menu = await waitFor(() => canvas.getByRole('menu'));
    await expect(menu).toHaveClass('max-sm:fixed');
    await expect(menu).toHaveClass('max-sm:left-4');
    await expect(menu).toHaveClass('max-sm:right-4');
    await expect(menu).toHaveClass('max-sm:bottom-4');
  },
};

const mobileInlineSpies = createSpies();
export const MobileInline: Story = {
  args: { mobileMode: 'inline' },
  render: renderWithSpies(mobileInlineSpies),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Actions' }));
    const menu = await waitFor(() => canvas.getByRole('menu'));
    await expect(menu).toHaveClass('max-sm:static');
    await expect(menu).toHaveClass('max-sm:mt-2');
    await expect(menu).toHaveClass('max-sm:shadow-none');
  },
};
