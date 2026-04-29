# Design System Phase 2 CSP Dropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a responsive, accessible `tai-dropdown-menu` molecule that replaces CDK menu usage in `data-table`, `sidebar`, and `user-profile`, then document and demonstrate the strict-CSP security story.

**Architecture:** Implement dropdown behavior with local DOM, Angular signals, static Tailwind/CSS classes, and no CDK overlay/menu APIs. Keep `CdkTableModule` in `data-table`, but remove `CdkMenuModule`, `cdkMenu`, `cdkMenuItem`, and `cdkMenuTriggerFor` from the target consumers. This plan assumes Phase 1 has landed the tiered paths and atom components.

**Tech Stack:** Angular 21 standalone components, Angular signals, Tailwind CSS 4, Nx, Vitest, Storybook.

---

## Prerequisites

Phase 1 must be complete before executing this plan.

Expected files:

```text
libs/ui/design-system/src/lib/atoms/button/button.component.ts
libs/ui/design-system/src/lib/atoms/icon/icon.component.ts
libs/ui/design-system/src/lib/molecules/form-field/form-field.component.ts
libs/ui/design-system/src/lib/organisms/data-table/data-table.ts
libs/ui/design-system/src/lib/organisms/sidebar/sidebar.component.ts
libs/ui/design-system/src/lib/organisms/user-profile/user-profile.component.ts
libs/ui/design-system/src/index.ts
```

If Phase 1 landed different paths, align this plan to the landed Phase 1 structure before executing tasks. Do not reintroduce `libs/ui/design-system/src/lib/design-system/data-table`, `libs/ui/design-system/src/lib/sidebar`, or `libs/ui/design-system/src/lib/user-profile`.

---

## File Structure

Create:

```text
libs/ui/design-system/src/lib/molecules/dropdown-menu/dropdown-menu.component.ts
libs/ui/design-system/src/lib/molecules/dropdown-menu/dropdown-menu.component.html
libs/ui/design-system/src/lib/molecules/dropdown-menu/dropdown-menu.component.scss
libs/ui/design-system/src/lib/molecules/dropdown-menu/dropdown-menu.component.spec.ts
libs/ui/design-system/src/lib/molecules/dropdown-menu/dropdown-menu.stories.ts
libs/ui/design-system/src/lib/security/strict-csp-demo.stories.ts
libs/ui/design-system/SECURITY.md
```

Modify:

```text
libs/ui/design-system/src/index.ts
libs/ui/design-system/src/lib/organisms/data-table/data-table.ts
libs/ui/design-system/src/lib/organisms/data-table/data-table.html
libs/ui/design-system/src/lib/organisms/data-table/data-table.spec.ts
libs/ui/design-system/src/lib/organisms/user-profile/user-profile.component.ts
libs/ui/design-system/src/lib/organisms/user-profile/user-profile.component.html
libs/ui/design-system/src/lib/organisms/user-profile/user-profile.component.spec.ts
libs/ui/design-system/src/lib/organisms/sidebar/sidebar.component.ts
libs/ui/design-system/src/lib/organisms/sidebar/sidebar.component.html
libs/ui/design-system/src/lib/organisms/sidebar/sidebar.component.spec.ts
```

---

## Task 1: Add Dropdown Menu Molecule

**Files:**
- Create: `libs/ui/design-system/src/lib/molecules/dropdown-menu/dropdown-menu.component.ts`
- Create: `libs/ui/design-system/src/lib/molecules/dropdown-menu/dropdown-menu.component.html`
- Create: `libs/ui/design-system/src/lib/molecules/dropdown-menu/dropdown-menu.component.scss`
- Create: `libs/ui/design-system/src/lib/molecules/dropdown-menu/dropdown-menu.component.spec.ts`
- Create: `libs/ui/design-system/src/lib/molecules/dropdown-menu/dropdown-menu.stories.ts`
- Modify: `libs/ui/design-system/src/index.ts`

- [ ] **Step 1: Write the failing unit test**

Create `dropdown-menu.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { DropdownMenuComponent, DropdownMenuItem } from './dropdown-menu.component';

const items: DropdownMenuItem[] = [
  { id: 'profile', label: 'My Profile' },
  { id: 'settings', label: 'Account Settings' },
  { id: 'disabled', label: 'Disabled Action', disabled: true },
  { id: 'logout', label: '<img src=x onerror=alert(1)>Logout', destructive: true },
];

describe('DropdownMenuComponent', () => {
  let component: DropdownMenuComponent;
  let fixture: ComponentFixture<DropdownMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DropdownMenuComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DropdownMenuComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('triggerLabel', 'Actions');
    fixture.componentRef.setInput('ariaLabel', 'Actions');
    fixture.componentRef.setInput('testId', 'actions');
    fixture.detectChanges();
  });

  it('creates and renders a closed trigger', () => {
    expect(component).toBeTruthy();
    const trigger = fixture.nativeElement.querySelector('[data-testid="actions-trigger"]') as HTMLButtonElement;
    expect(trigger).toBeTruthy();
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeNull();
  });

  it('opens and closes from trigger click', () => {
    const trigger = fixture.nativeElement.querySelector('[data-testid="actions-trigger"]') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeTruthy();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    trigger.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeNull();
  });

  it('emits selected item for enabled item and closes', () => {
    const spy = vi.fn();
    component.itemSelected.subscribe(spy);

    component.open();
    fixture.detectChanges();
    const profile = fixture.nativeElement.querySelector('[data-testid="actions-item-profile"]') as HTMLButtonElement;
    profile.click();
    fixture.detectChanges();

    expect(spy).toHaveBeenCalledWith(items[0]);
    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeNull();
  });

  it('does not emit for disabled item', () => {
    const spy = vi.fn();
    component.itemSelected.subscribe(spy);

    component.open();
    fixture.detectChanges();
    const disabled = fixture.nativeElement.querySelector('[data-testid="actions-item-disabled"]') as HTMLButtonElement;
    disabled.click();

    expect(spy).not.toHaveBeenCalled();
  });

  it('renders labels as text instead of HTML', () => {
    component.open();
    fixture.detectChanges();

    const logout = fixture.nativeElement.querySelector('[data-testid="actions-item-logout"]') as HTMLElement;
    expect(logout.textContent).toContain('<img src=x onerror=alert(1)>Logout');
    expect(logout.querySelector('img')).toBeNull();
  });

  it('closes on Escape and returns focus to trigger', () => {
    component.open();
    fixture.detectChanges();
    const trigger = fixture.nativeElement.querySelector('[data-testid="actions-trigger"]') as HTMLButtonElement;
    const menu = fixture.nativeElement.querySelector('[role="menu"]') as HTMLElement;

    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('moves focus with arrow keys and Home/End', () => {
    component.open();
    fixture.detectChanges();
    const menu = fixture.nativeElement.querySelector('[role="menu"]') as HTMLElement;
    const enabledItems = () =>
      Array.from(fixture.nativeElement.querySelectorAll('[role="menuitem"]:not([disabled])')) as HTMLButtonElement[];

    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    fixture.detectChanges();
    expect(document.activeElement).toBe(enabledItems().at(-1));

    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    fixture.detectChanges();
    expect(document.activeElement).toBe(enabledItems()[0]);

    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    expect(document.activeElement).toBe(enabledItems()[1]);
  });

  it('applies placement, density, and mobile mode classes', () => {
    fixture.componentRef.setInput('placement', 'top-start');
    fixture.componentRef.setInput('density', 'compact');
    fixture.componentRef.setInput('mobileMode', 'sheet');
    component.open();
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('[role="menu"]') as HTMLElement;
    expect(panel.className).toContain('bottom-full');
    expect(panel.className).toContain('right-auto');
    expect(panel.className).toContain('data-[density=compact]');
    expect(panel.className).toContain('max-sm:fixed');
  });

  it('closes when clicking outside', () => {
    component.open();
    fixture.detectChanges();

    document.body.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
CI=true npx nx test design-system --skip-nx-cache --testFile=dropdown-menu.component.spec.ts
```

Expected: FAIL because `DropdownMenuComponent` does not exist.

- [ ] **Step 3: Add the component TypeScript**

Create `dropdown-menu.component.ts`:

```typescript
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  QueryList,
  ViewChild,
  ViewChildren,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../../atoms/button/button.component';
import { IconComponent, TaiIconName } from '../../atoms/icon/icon.component';

export type DropdownPlacement =
  | 'bottom-start'
  | 'bottom-end'
  | 'top-start'
  | 'top-end';

export type DropdownMobileMode = 'sheet' | 'inline';

export type DropdownDensity = 'compact' | 'comfortable';

export interface DropdownMenuItem {
  id: string;
  label: string;
  icon?: TaiIconName;
  disabled?: boolean;
  destructive?: boolean;
  active?: boolean;
}

@Component({
  selector: 'tai-dropdown-menu',
  standalone: true,
  imports: [CommonModule, ButtonComponent, IconComponent],
  templateUrl: './dropdown-menu.component.html',
  styleUrl: './dropdown-menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DropdownMenuComponent {
  readonly items = input.required<DropdownMenuItem[]>();
  readonly placement = input<DropdownPlacement>('bottom-end');
  readonly mobileMode = input<DropdownMobileMode>('sheet');
  readonly density = input<DropdownDensity>('comfortable');
  readonly ariaLabel = input<string>('Menu');
  readonly triggerLabel = input<string>('');
  readonly triggerIcon = input<TaiIconName | null>(null);
  readonly testId = input<string>('dropdown-menu');

  readonly itemSelected = output<DropdownMenuItem>();
  readonly opened = output<void>();
  readonly closed = output<void>();

  @ViewChild('triggerButton', { read: ElementRef })
  private readonly triggerButton?: ElementRef<HTMLButtonElement>;

  @ViewChildren('menuItemButton', { read: ElementRef })
  private readonly menuItemButtons?: QueryList<ElementRef<HTMLButtonElement>>;

  protected readonly isOpen = signal(false);

  protected readonly panelClasses = computed(() => {
    const base =
      'tai-dropdown-panel z-50 min-w-40 max-w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-xl outline-none max-h-[min(24rem,calc(100dvh-2rem))] overflow-y-auto';
    const densityClass = ` data-[density=${this.density()}]`;
    const placementClass = this.placementClasses();
    const mobileClass =
      this.mobileMode() === 'sheet'
        ? ' max-sm:fixed max-sm:left-4 max-sm:right-4 max-sm:bottom-4 max-sm:top-auto max-sm:mt-0 max-sm:max-w-none max-sm:rounded-lg'
        : ' max-sm:static max-sm:mt-2 max-sm:max-w-none max-sm:shadow-none';

    return `${base}${densityClass} ${placementClass}${mobileClass}`;
  });

  protected readonly itemClasses = computed(() => {
    const base =
      'flex w-full items-center gap-2 border-0 bg-transparent text-left outline-none transition-colors duration-150 focus:ring-2 focus:ring-blue-500 focus:ring-inset disabled:cursor-not-allowed disabled:opacity-50';
    const densityClass =
      this.density() === 'compact'
        ? ' min-h-10 px-3 py-2 text-sm'
        : ' min-h-11 px-4 py-2.5 text-sm';
    return `${base}${densityClass}`;
  });

  open(): void {
    if (this.isOpen()) {
      return;
    }
    this.isOpen.set(true);
    this.opened.emit();
    queueMicrotask(() => this.focusFirstEnabledItem());
  }

  close(options: { restoreFocus?: boolean } = {}): void {
    if (!this.isOpen()) {
      return;
    }
    this.isOpen.set(false);
    this.closed.emit();
    if (options.restoreFocus) {
      queueMicrotask(() => this.triggerButton?.nativeElement.focus());
    }
  }

  toggle(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  protected onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.open();
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.open();
      queueMicrotask(() => this.focusFirstEnabledItem());
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.open();
      queueMicrotask(() => this.focusLastEnabledItem());
    }
  }

  protected onPanelKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close({ restoreFocus: true });
      return;
    }

    if (event.key === 'Tab') {
      this.close();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.focusNextItem();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.focusPreviousItem();
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      this.focusFirstEnabledItem();
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      this.focusLastEnabledItem();
    }
  }

  protected selectItem(item: DropdownMenuItem): void {
    if (item.disabled) {
      return;
    }
    this.itemSelected.emit(item);
    this.close({ restoreFocus: true });
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (!target || !this.isOpen()) {
      return;
    }

    const host = this.host.nativeElement;
    if (!host.contains(target)) {
      this.close();
    }
  }

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  private placementClasses(): string {
    const classes: Record<DropdownPlacement, string> = {
      'bottom-start': 'absolute left-0 right-auto top-full mt-2',
      'bottom-end': 'absolute right-0 left-auto top-full mt-2',
      'top-start': 'absolute left-0 right-auto bottom-full mb-2',
      'top-end': 'absolute right-0 left-auto bottom-full mb-2',
    };
    return classes[this.placement()];
  }

  private enabledButtons(): HTMLButtonElement[] {
    if (!this.menuItemButtons) {
      return [];
    }
    return this.menuItemButtons
      .toArray()
      .map((button) => button.nativeElement)
      .filter((button) => !button.disabled);
  }

  private focusFirstEnabledItem(): void {
    this.enabledButtons()[0]?.focus();
  }

  private focusLastEnabledItem(): void {
    this.enabledButtons().at(-1)?.focus();
  }

  private focusNextItem(): void {
    const buttons = this.enabledButtons();
    if (buttons.length === 0) {
      return;
    }
    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[(currentIndex + 1 + buttons.length) % buttons.length].focus();
  }

  private focusPreviousItem(): void {
    const buttons = this.enabledButtons();
    if (buttons.length === 0) {
      return;
    }
    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[(currentIndex - 1 + buttons.length) % buttons.length].focus();
  }
}
```

- [ ] **Step 4: Add the component template**

Create `dropdown-menu.component.html`:

```html
<div class="tai-dropdown-menu relative inline-flex">
  <button
    #triggerButton
    type="button"
    class="tai-dropdown-trigger inline-flex min-h-11 items-center justify-center gap-2 rounded-md border-0 bg-transparent px-3 py-2 text-sm font-semibold text-gray-700 outline-none transition-colors duration-200 hover:bg-gray-100 focus:ring-3 focus:ring-blue-600/20"
    [attr.aria-label]="ariaLabel()"
    aria-haspopup="menu"
    [attr.aria-expanded]="isOpen()"
    [attr.data-testid]="testId() + '-trigger'"
    (click)="toggle()"
    (keydown)="onTriggerKeydown($event)"
  >
    @if (triggerIcon()) {
      <tai-icon [name]="triggerIcon()!" size="sm" />
    }
    @if (triggerLabel()) {
      <span [textContent]="triggerLabel()"></span>
    }
    <ng-content select="[taiDropdownTrigger]"></ng-content>
  </button>

  @if (isOpen()) {
    <div
      role="menu"
      tabindex="-1"
      [class]="panelClasses()"
      [attr.aria-label]="ariaLabel()"
      [attr.data-density]="density()"
      [attr.data-testid]="testId() + '-panel'"
      (keydown)="onPanelKeydown($event)"
    >
      @for (item of items(); track item.id) {
        <button
          #menuItemButton
          type="button"
          role="menuitem"
          [disabled]="item.disabled"
          [attr.aria-disabled]="item.disabled ? 'true' : null"
          [attr.aria-current]="item.active ? 'page' : null"
          [attr.data-testid]="testId() + '-item-' + item.id"
          [class]="itemClasses()"
          [class.text-red-600]="item.destructive"
          [class.text-gray-900]="!item.destructive"
          [class.bg-blue-50]="item.active"
          [class.hover:bg-gray-50]="!item.disabled"
          (click)="selectItem(item)"
        >
          @if (item.icon) {
            <tai-icon [name]="item.icon" size="sm" />
          }
          <span class="truncate" [textContent]="item.label"></span>
        </button>
      }
    </div>
  }
</div>
```

- [ ] **Step 5: Add component styles**

Create `dropdown-menu.component.scss`:

```scss
:host {
  display: inline-flex;
}

.tai-dropdown-panel {
  transform-origin: top right;
}

@media (prefers-reduced-motion: no-preference) {
  .tai-dropdown-panel {
    animation: tai-dropdown-enter 120ms ease-out;
  }
}

@keyframes tai-dropdown-enter {
  from {
    opacity: 0;
    transform: translateY(-0.25rem);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

- [ ] **Step 6: Add the Storybook story**

Create `dropdown-menu.stories.ts`:

```typescript
import type { Meta, StoryObj } from '@storybook/angular';
import { fn, userEvent, within, expect } from '@storybook/test';
import { DropdownMenuComponent, DropdownMenuItem } from './dropdown-menu.component';

const items: DropdownMenuItem[] = [
  { id: 'profile', label: 'My Profile' },
  { id: 'settings', label: 'Account Settings' },
  { id: 'logout', label: 'Logout', destructive: true },
];

const meta: Meta<DropdownMenuComponent> = {
  title: 'Molecules/Dropdown Menu',
  component: DropdownMenuComponent,
  args: {
    items,
    triggerLabel: 'Actions',
    ariaLabel: 'Actions',
    placement: 'bottom-end',
    mobileMode: 'sheet',
    density: 'comfortable',
    testId: 'story-dropdown',
    itemSelected: fn(),
  },
};

export default meta;
type Story = StoryObj<DropdownMenuComponent>;

export const Default: Story = {};

export const Compact: Story = {
  args: {
    density: 'compact',
    triggerIcon: 'more-vertical',
    triggerLabel: '',
  },
};

export const OpensWithKeyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId('story-dropdown-trigger');
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByRole('menu')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await expect(trigger).toHaveFocus();
  },
};
```

- [ ] **Step 7: Export the molecule**

Add this line to `libs/ui/design-system/src/index.ts`:

```typescript
export * from './lib/molecules/dropdown-menu/dropdown-menu.component';
```

- [ ] **Step 8: Run the dropdown test**

Run:

```bash
CI=true npx nx test design-system --skip-nx-cache --testFile=dropdown-menu.component.spec.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add libs/ui/design-system/src/lib/molecules/dropdown-menu libs/ui/design-system/src/index.ts
git commit -m "feat(ui): add CSP-safe dropdown menu molecule"
```

---

## Task 2: Replace Data Table CDK Action Menu

**Files:**
- Modify: `libs/ui/design-system/src/lib/organisms/data-table/data-table.ts`
- Modify: `libs/ui/design-system/src/lib/organisms/data-table/data-table.html`
- Modify: `libs/ui/design-system/src/lib/organisms/data-table/data-table.spec.ts`

- [ ] **Step 1: Update the failing test**

In `data-table.spec.ts`, remove:

```typescript
import { CdkMenuModule } from '@angular/cdk/menu';
```

Change the TestBed imports to:

```typescript
imports: [DataTableComponent, CdkTableModule],
```

Add these tests:

```typescript
it('uses tai-dropdown-menu for row actions', () => {
  const dropdowns = fixture.nativeElement.querySelectorAll('tai-dropdown-menu');
  expect(dropdowns.length).toBe(2);
});

it('does not render CDK menu directives for row actions', () => {
  expect(fixture.nativeElement.querySelector('[cdkMenu]')).toBeNull();
  expect(fixture.nativeElement.querySelector('[cdkMenuItem]')).toBeNull();
});

it('emits actionTriggered when dropdown item is selected', () => {
  const spy = vi.fn();
  component.actionTriggered.subscribe(spy);

  component.onDropdownAction(actions[0], data[0]);

  expect(spy).toHaveBeenCalledWith({ actionId: 'edit', row: data[0] });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
CI=true npx nx test design-system --skip-nx-cache --testFile=data-table.spec.ts
```

Expected: FAIL because the component still imports and renders CDK menu usage.

- [ ] **Step 3: Update TypeScript imports and helpers**

In `data-table.ts`, remove:

```typescript
import { CdkMenuModule } from '@angular/cdk/menu';
```

Add:

```typescript
import {
  DropdownMenuComponent,
  DropdownMenuItem,
} from '../../molecules/dropdown-menu/dropdown-menu.component';
```

Change the component imports array:

```typescript
imports: [CommonModule, CdkTableModule, DropdownMenuComponent],
```

Add these public methods:

```typescript
public visibleActionsFor(row: T): TableActionDef<T>[] {
  return this.actions().filter((action) => this.isActionVisible(action, row));
}

public dropdownItemsFor(row: T): DropdownMenuItem[] {
  return this.visibleActionsFor(row).map((action) => ({
    id: action.id,
    label: action.label,
  }));
}

public onDropdownAction(action: TableActionDef<T>, row: T): void {
  this.onAction(action.id, row);
}

public onDropdownItemSelected(item: DropdownMenuItem, row: T): void {
  const action = this.visibleActionsFor(row).find(
    (candidate) => candidate.id === item.id,
  );
  if (action) {
    this.onDropdownAction(action, row);
  }
}
```

- [ ] **Step 4: Replace the action menu template**

In `data-table.html`, replace the existing native action menu trigger, `ng-template`, `cdkMenu`, and `cdkMenuItem` block with:

```html
<tai-dropdown-menu
  ariaLabel="Row actions"
  triggerIcon="more-vertical"
  placement="bottom-end"
  mobileMode="sheet"
  density="compact"
  [items]="dropdownItemsFor(row)"
  [testId]="'action-menu-' + (row.id || row.Id)"
  (itemSelected)="onDropdownItemSelected($event, row)"
></tai-dropdown-menu>
```

This preserves the action selection behavior while removing CDK menu and caller-provided action classes from the menu surface.

- [ ] **Step 5: Run the data-table test**

Run:

```bash
CI=true npx nx test design-system --skip-nx-cache --testFile=data-table.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/ui/design-system/src/lib/organisms/data-table
git commit -m "refactor(ui): replace data table CDK menu"
```

---

## Task 3: Replace User Profile CDK Menu

**Files:**
- Modify: `libs/ui/design-system/src/lib/organisms/user-profile/user-profile.component.ts`
- Modify: `libs/ui/design-system/src/lib/organisms/user-profile/user-profile.component.html`
- Modify: `libs/ui/design-system/src/lib/organisms/user-profile/user-profile.component.spec.ts`

- [ ] **Step 1: Update the failing test**

Add imports in `user-profile.component.spec.ts`:

```typescript
import { DropdownMenuItem } from '../../molecules/dropdown-menu/dropdown-menu.component';
```

Add these tests:

```typescript
it('renders profile actions through tai-dropdown-menu', () => {
  fixture.componentRef.setInput('user', { name: 'John Doe' });
  fixture.detectChanges();

  const dropdown = fixture.nativeElement.querySelector('tai-dropdown-menu');
  expect(dropdown).toBeTruthy();
});

it('emits logout when logout dropdown item is selected', () => {
  const logoutSpy = vi.fn();
  component.logout.subscribe(logoutSpy);

  component.onProfileAction({ id: 'logout', label: 'Logout' } as DropdownMenuItem);

  expect(logoutSpy).toHaveBeenCalled();
});

it('does not render CDK menu directives', () => {
  expect(fixture.nativeElement.querySelector('[cdkMenu]')).toBeNull();
  expect(fixture.nativeElement.querySelector('[cdkMenuItem]')).toBeNull();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
CI=true npx nx test design-system --skip-nx-cache --testFile=user-profile.component.spec.ts
```

Expected: FAIL because `UserProfileComponent` still imports `CdkMenuModule` and renders CDK menu directives.

- [ ] **Step 3: Update TypeScript**

In `user-profile.component.ts`, remove:

```typescript
import { CdkMenuModule } from '@angular/cdk/menu';
```

Add:

```typescript
import {
  DropdownMenuComponent,
  DropdownMenuItem,
} from '../../molecules/dropdown-menu/dropdown-menu.component';
```

Change component imports:

```typescript
imports: [CommonModule, DropdownMenuComponent],
```

Add profile menu items:

```typescript
readonly profileActions: DropdownMenuItem[] = [
  { id: 'profile', label: 'My Profile' },
  { id: 'settings', label: 'Account Settings' },
  { id: 'logout', label: 'Logout', destructive: true },
];
```

Add this method:

```typescript
onProfileAction(item: DropdownMenuItem): void {
  if (item.id === 'logout') {
    this.onLogout();
  }
}
```

- [ ] **Step 4: Replace the template**

Replace `user-profile.component.html` with:

```html
<div class="user-profile flex items-center gap-2">
  <tai-dropdown-menu
    ariaLabel="User Profile"
    placement="bottom-end"
    mobileMode="sheet"
    density="comfortable"
    testId="user-profile-menu"
    [items]="profileActions"
    (itemSelected)="onProfileAction($event)"
  >
    <span
      taiDropdownTrigger
      class="user-profile-trigger flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-sm font-semibold text-white transition-colors duration-200"
    >
      @if (user()?.avatar) {
        <img
          [src]="user()?.avatar"
          [alt]="user()?.name"
          class="user-avatar h-full w-full rounded-full object-cover"
        />
      } @else {
        <span [textContent]="initials()"></span>
      }
    </span>
  </tai-dropdown-menu>
</div>
```

- [ ] **Step 5: Run the user-profile test**

Run:

```bash
CI=true npx nx test design-system --skip-nx-cache --testFile=user-profile.component.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/ui/design-system/src/lib/organisms/user-profile
git commit -m "refactor(ui): replace user profile CDK menu"
```

---

## Task 4: Replace Sidebar CDK Menu

**Files:**
- Modify: `libs/ui/design-system/src/lib/organisms/sidebar/sidebar.component.ts`
- Modify: `libs/ui/design-system/src/lib/organisms/sidebar/sidebar.component.html`
- Modify: `libs/ui/design-system/src/lib/organisms/sidebar/sidebar.component.spec.ts`

- [ ] **Step 1: Update the failing test**

Add this test to `sidebar.component.spec.ts`:

```typescript
it('does not render CDK menu directives', () => {
  fixture.componentRef.setInput('menuItems', [
    { label: 'Dashboard', link: '/dashboard' },
    { label: 'Settings', link: '/settings' },
  ]);
  fixture.detectChanges();

  expect(fixture.nativeElement.querySelector('[cdkMenu]')).toBeNull();
  expect(fixture.nativeElement.querySelector('[cdkMenuItem]')).toBeNull();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
CI=true npx nx test design-system --skip-nx-cache --testFile=sidebar.component.spec.ts
```

Expected: FAIL because the template still contains `cdkMenu` and `cdkMenuItem`.

- [ ] **Step 3: Update TypeScript**

In `sidebar.component.ts`, remove:

```typescript
import { CdkMenuModule } from '@angular/cdk/menu';
```

Change component imports:

```typescript
imports: [CommonModule, RouterModule],
```

Update the component comment so it no longer claims CDK menu usage:

```typescript
/**
 * SidebarComponent: The primary navigation backbone of the Portal.
 *
 * Uses local DOM navigation controls and static Tailwind/CSS classes to stay
 * compatible with strict CSP while preserving accessible router navigation.
 */
```

- [ ] **Step 4: Replace the template**

Replace `sidebar.component.html` with:

```html
<nav
  class="sidebar flex h-screen flex-col bg-gray-800 text-gray-100 shadow-lg transition-all duration-300"
  aria-label="Main Navigation"
  [class.collapsed]="collapsed()"
  [class.w-[250px]]="!collapsed()"
  [class.w-[64px]]="collapsed()"
>
  @if (!collapsed()) {
    <div class="sidebar-header border-b border-gray-700 p-4 text-xl font-bold">
      Portal
    </div>
  }

  <ul class="sidebar-menu m-0 flex grow list-none flex-col py-2">
    @for (item of menuItems(); track item.label) {
      <li>
        <a
          class="sidebar-menu-item box-border flex w-full cursor-pointer items-center px-4 py-3 text-left font-inherit text-inherit no-underline outline-none transition-colors duration-200 hover:bg-gray-700 focus:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:ring-inset"
          [routerLink]="item.link"
          [title]="item.label"
        >
          @if (item.icon) {
            <span
              class="sidebar-menu-item-icon mr-3 text-lg"
              [class.mr-0]="collapsed()"
              [textContent]="item.icon"
            ></span>
          }
          @if (!collapsed()) {
            <span
              class="sidebar-menu-item-label truncate"
              [textContent]="item.label"
            ></span>
          }
        </a>
      </li>
    }
  </ul>
</nav>
```

This removes CDK menu semantics from static router navigation. If future Phase 2 execution finds actual sidebar popup/submenu behavior after Phase 1, use `tai-dropdown-menu mobileMode="inline"` for those submenu items instead of reintroducing CDK menu.

- [ ] **Step 5: Update existing test selector**

In `sidebar.component.spec.ts`, change:

```typescript
const buttons = compiled.querySelectorAll('button.sidebar-menu-item');
```

to:

```typescript
const buttons = compiled.querySelectorAll('a.sidebar-menu-item');
```

- [ ] **Step 6: Run the sidebar test**

Run:

```bash
CI=true npx nx test design-system --skip-nx-cache --testFile=sidebar.component.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add libs/ui/design-system/src/lib/organisms/sidebar
git commit -m "refactor(ui): remove sidebar CDK menu usage"
```

---

## Task 5: Add SECURITY.md

**Files:**
- Create: `libs/ui/design-system/SECURITY.md`

- [ ] **Step 1: Create the security documentation**

Create `SECURITY.md`:

````markdown
# Design System Security

## Goal

The Portal design system is built for strict Content Security Policy compatibility and auditability. Components should render predictable local DOM, use build-time CSS, and avoid runtime style or HTML injection.

## CSP Target

The target production posture is:

```text
default-src 'self';
script-src 'self';
style-src 'self';
img-src 'self' data:;
font-src 'self';
object-src 'none';
base-uri 'self';
form-action 'self';
```

## Tailwind

Tailwind is used as a build-time styling engine. Utility classes are compiled into static CSS and served from `self`.

Do not build Tailwind class names from user-controlled values. Keep variant and state classes explicit in component code.

## Approved Patterns

- Angular interpolation for plain text
- `[textContent]` for user-facing dynamic strings
- static Tailwind utility classes
- component-owned typed inputs
- local DOM composition
- CSS media queries for responsive layout
- Angular CDK structural primitives only when they do not create overlay, portal, or runtime positioning behavior

## Banned Patterns

- `style=""`
- `[style]`
- `[innerHTML]`
- `DomSanitizer.bypassSecurityTrust*`
- runtime-generated Tailwind class names from user data
- Angular Material components in design-system primitives
- CDK overlay-backed dropdown, menu, tooltip, popover, or dialog behavior in design-system components

## CDK Usage Policy

Not all Angular CDK usage carries the same risk.

`CdkTableModule` is allowed for now as a structural table rendering primitive. It must stay under review, especially if sticky columns or sticky headers are introduced.

`CdkMenuModule`, `OverlayModule`, and overlay-backed trigger directives are not allowed in design-system components that need strict zero-inline-style CSP compatibility.

## Dropdown Security Rationale

`tai-dropdown-menu` uses local DOM, Angular state, and static CSS classes. It does not use CDK overlay, portals, Material menus, or runtime inline positioning.

Desktop and tablet placement is handled through predefined CSS classes. Phone behavior uses CSS-driven action-sheet or inline modes.

## Review Checklist

Before merging design-system component changes:

- Run the lint, test, and build targets.
- Scan for banned HTML and Angular sinks.
- Confirm user-facing dynamic text uses interpolation or `[textContent]`.
- Confirm responsive behavior is CSS-driven.
- Confirm keyboard behavior is covered by unit tests for interactive molecules and organisms.
- Confirm Storybook stories cover default, compact, mobile, and security-relevant states.
````

- [ ] **Step 2: Commit**

```bash
git add libs/ui/design-system/SECURITY.md
git commit -m "docs(ui): document design system CSP rules"
```

---

## Task 6: Add Strict-CSP Storybook Demo

**Files:**
- Create: `libs/ui/design-system/src/lib/security/strict-csp-demo.stories.ts`

- [ ] **Step 1: Add the Storybook demo**

Create `strict-csp-demo.stories.ts`:

```typescript
import type { Meta, StoryObj } from '@storybook/angular';
import { expect, within } from '@storybook/test';
import { DropdownMenuComponent, DropdownMenuItem } from '../molecules/dropdown-menu/dropdown-menu.component';
import { DataTableComponent, TableActionDef, TableColumnDef } from '../organisms/data-table/data-table';
import { SidebarComponent, MenuItem } from '../organisms/sidebar/sidebar.component';
import { UserProfileComponent } from '../organisms/user-profile/user-profile.component';

interface DemoRow {
  id: string;
  name: string;
  status: string;
}

const dropdownItems: DropdownMenuItem[] = [
  { id: 'view', label: 'View Details' },
  { id: 'archive', label: 'Archive' },
  { id: 'delete', label: 'Delete', destructive: true },
];

const rows: DemoRow[] = [
  { id: '1', name: 'Jane Smith', status: 'Active' },
  { id: '2', name: 'Alex Lee', status: 'Pending' },
];

const columns: TableColumnDef<DemoRow>[] = [
  { id: 'name', header: 'Name', cell: (row) => row.name, sortable: true },
  { id: 'status', header: 'Status', cell: (row) => row.status },
];

const actions: TableActionDef<DemoRow>[] = [
  { id: 'view', label: 'View Details' },
  { id: 'approve', label: 'Approve', visible: (row) => row.status === 'Pending' },
];

const navItems: MenuItem[] = [
  { label: 'Dashboard', link: '/dashboard', icon: 'D' },
  { label: 'Users', link: '/users', icon: 'U' },
];

const meta: Meta = {
  title: 'Security/Strict CSP Demo',
  render: () => ({
    imports: [
      DropdownMenuComponent,
      DataTableComponent,
      SidebarComponent,
      UserProfileComponent,
    ],
    props: {
      dropdownItems,
      rows,
      columns,
      actions,
      navItems,
      violations: [] as SecurityPolicyViolationEvent[],
      onViolation(event: SecurityPolicyViolationEvent) {
        this.violations.push(event);
      },
    },
    template: `
      <section
        class="grid gap-6 p-6"
        (securitypolicyviolation)="onViolation($event)"
        data-testid="strict-csp-demo"
      >
        <header>
          <h2 class="text-xl font-bold text-gray-900">Strict CSP Component Surface</h2>
          <p class="mt-1 text-sm text-gray-600">
            This story exercises local-DOM dropdown behavior without CDK menu or overlay primitives.
          </p>
        </header>

        <tai-dropdown-menu
          ariaLabel="Demo actions"
          triggerLabel="Actions"
          testId="strict-csp-dropdown"
          [items]="dropdownItems"
        />

        <tai-data-table
          [data]="rows"
          [columns]="columns"
          [actions]="actions"
          [totalCount]="rows.length"
        />

        <div class="flex items-start gap-6">
          <tai-sidebar [menuItems]="navItems" />
          <tai-user-profile [user]="{ name: 'Jane Smith' }" />
        </div>

        @if (violations.length > 0) {
          <div class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            CSP violations detected.
          </div>
        }
      </section>
    `,
  }),
};

export default meta;
type Story = StoryObj;

export const ComponentSurface: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('strict-csp-demo')).toBeInTheDocument();
    await expect(canvas.getByTestId('strict-csp-dropdown-trigger')).toBeInTheDocument();
  },
};
```

- [ ] **Step 2: Run Storybook build**

Run:

```bash
CI=true npx nx build-storybook design-system --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add libs/ui/design-system/src/lib/security/strict-csp-demo.stories.ts
git commit -m "test(ui): add strict CSP Storybook demo"
```

---

## Task 7: Static Security Scans and Final Verification

**Files:**
- No new files.
- Modify files only if verification finds small issues.

- [ ] **Step 1: Verify CDK menu usage was removed from target consumers**

Run:

```bash
rg -n "CdkMenuModule|cdkMenu|cdkMenuItem|cdkMenuTriggerFor" libs/ui/design-system/src/lib/organisms/data-table libs/ui/design-system/src/lib/organisms/sidebar libs/ui/design-system/src/lib/organisms/user-profile
```

Expected: no matches.

- [ ] **Step 2: Verify no banned CSP escape hatches in new implementation files**

Run:

```bash
rg -n "innerHTML|\\[style\\]|style=|DomSanitizer|bypassSecurityTrust" libs/ui/design-system/src/lib/molecules/dropdown-menu libs/ui/design-system/src/lib/security
```

Expected: no matches.

- [ ] **Step 3: Run design-system verification**

Run:

```bash
CI=true npx nx lint design-system --skip-nx-cache
CI=true npx nx test design-system --skip-nx-cache
CI=true npx nx build design-system --skip-nx-cache
CI=true npx nx build-storybook design-system --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 4: Run consumer verification**

Run:

```bash
CI=true npx nx lint portal-web --skip-nx-cache
CI=true npx nx test portal-web --skip-nx-cache
CI=true npx nx build portal-web --skip-nx-cache
CI=true npx nx e2e portal-web-e2e --skip-nx-cache
CI=true npx nx lint identity-ui --skip-nx-cache
CI=true npx nx test identity-ui --skip-nx-cache
CI=true npx nx build identity-ui --skip-nx-cache
CI=true npx nx e2e identity-ui-e2e --skip-nx-cache
CI=true npx nx lint borrower-portal --skip-nx-cache
CI=true npx nx test borrower-portal --skip-nx-cache
CI=true npx nx build borrower-portal --skip-nx-cache
CI=true npx nx e2e borrower-portal-e2e --skip-nx-cache
```

Expected: PASS. All e2e commands are required to pass before Phase 2 is considered complete.

- [ ] **Step 5: Commit verification fixes**

Only run this if verification required small fixes:

```bash
git add libs/ui/design-system apps/portal-web apps/identity-ui apps/borrower-portal apps/portal-web-e2e apps/identity-ui-e2e apps/borrower-portal-e2e
git commit -m "test(ui): verify CSP dropdown integration"
```

---

## Self-Review

Spec coverage:

- Adds `tai-dropdown-menu` as a Tier 2 molecule.
- Replaces CDK menu usage in `data-table`, `sidebar`, and `user-profile`.
- Keeps `CdkTableModule` in `data-table`.
- Adds `SECURITY.md`.
- Adds a strict-CSP Storybook demo.
- Requires static CSP scans and cross-project lint, test, build, and e2e verification.

Placeholder scan:

- No implementation step uses placeholder wording.
- Code-bearing steps include concrete code or exact replacement snippets.

Type consistency:

- `DropdownMenuItem`, `DropdownPlacement`, `DropdownMobileMode`, and `DropdownDensity` are defined in Task 1 and reused consistently.
- Data table action mapping uses existing `TableActionDef<T>` and preserves `actionTriggered`.
- User profile action mapping uses `DropdownMenuItem` and preserves `logout`.
- Sidebar preserves the existing `MenuItem` API.

---

Plan complete and saved to `docs/superpowers/plans/2026-04-29-design-system-phase2-csp-dropdown-plan.md`. Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.
