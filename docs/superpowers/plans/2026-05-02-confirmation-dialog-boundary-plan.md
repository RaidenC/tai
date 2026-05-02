# Confirmation Dialog Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the CDK-backed confirmation dialog boundary with a reusable strict-CSP-safe `tai-confirmation-panel`, while moving modal lifecycle behavior into the users feature.

**Architecture:** `libs/ui/design-system` owns reusable confirmation content, typed action state, accessible markup, static class mappings, and the deprecated `tai-confirmation-dialog` compatibility wrapper. `apps/portal-web` owns the users approval modal host, manual focus management, Escape/backdrop behavior, async loading/retry behavior, and the `confirmed: boolean` result contract. A CI-enforced static scan prevents the new reusable panel from importing CDK dialog, overlay, focus, or Material primitives.

**Tech Stack:** Angular 21 standalone components, Angular signal inputs/outputs, Vitest Angular TestBed, Storybook Angular, Playwright E2E, Nx, Tailwind/static CSS classes, shell-based static import scan.

---

## File Structure

- Create: `libs/ui/design-system/src/lib/molecules/confirmation-panel/confirmation-panel.component.ts`
  - Owns the generic `tai-confirmation-panel` API, fallback normalization, clamping, tone mapping, focus target ids, and `actionSelected` output.
- Create: `libs/ui/design-system/src/lib/molecules/confirmation-panel/confirmation-panel.component.html`
  - Renders the local dialog content, title, message, preserved test ids, and action buttons.
- Create: `libs/ui/design-system/src/lib/molecules/confirmation-panel/confirmation-panel.component.scss`
  - Holds any local reduced-motion or compact layout rules not expressible cleanly with static classes.
- Create: `libs/ui/design-system/src/lib/molecules/confirmation-panel/confirmation-panel.component.spec.ts`
  - Tests rendering, fallbacks, clamping, disabled/loading priority, duplicate suppression, tone mapping, text safety, and import restrictions.
- Create: `libs/ui/design-system/src/lib/molecules/confirmation-panel/confirmation-panel.stories.ts`
  - Storybook coverage for default, danger, long message, loading, and security text rendering.
- Modify: `libs/ui/design-system/src/index.ts`
  - Export the new confirmation panel component and types while keeping the deprecated dialog export.
- Modify: `libs/ui/design-system/src/lib/molecules/confirmation-dialog/confirmation-dialog.ts`
  - Refactor `ConfirmationDialogComponent` into a deprecated wrapper over `ConfirmationPanelComponent`.
- Modify: `libs/ui/design-system/src/lib/molecules/confirmation-dialog/confirmation-dialog.html`
  - Replace direct dialog markup with a `tai-confirmation-panel` composition.
- Modify: `libs/ui/design-system/src/lib/molecules/confirmation-dialog/confirmation-dialog.spec.ts`
  - Update wrapper tests to prove legacy data mapping, old `DialogRef.close(true | false)` behavior, and ignored `confirmButtonClass`.
- Modify: `libs/ui/design-system/src/lib/molecules/confirmation-dialog/confirmation-dialog.stories.ts`
  - Keep compatibility stories, but remove `confirmButtonClass` examples and add deprecation context.
- Create: `apps/portal-web/src/app/features/users/users-confirmation-host.component.ts`
  - Owns local modal DOM, manual focus loop, Escape/backdrop close behavior, loading state, retry reset, and `confirmApproval(user): Promise<boolean>`.
- Create: `apps/portal-web/src/app/features/users/users-confirmation-host.component.spec.ts`
  - Tests the users host result mapping, focus behavior, manual focus loop, loading duplicate suppression, and no CDK imports.
- Modify: `apps/portal-web/src/app/features/users/users.page.ts`
  - Remove CDK dialog usage and use `UsersConfirmationHostComponent` through `@ViewChild`.
- Modify: `apps/portal-web/src/app/features/users/users.page.spec.ts`
  - Replace `Dialog` mocks with users confirmation host behavior and verify store approval only on `confirmed: true`.
- Modify: `apps/portal-web-e2e/src/users-approval.spec.ts`
  - Query the migrated modal by `role="dialog"` and preserved test ids instead of `tai-confirmation-dialog`.
- Create: `tools/check-confirmation-boundary.sh`
  - CI-friendly static scan for banned CDK dialog, overlay, focus, and Material imports in the reusable panel and users host.
- Modify: `package.json`
  - Add a script that runs the static scan.

---

### Task 1: Add Failing Confirmation Panel Unit Tests

**Files:**
- Create: `libs/ui/design-system/src/lib/molecules/confirmation-panel/confirmation-panel.component.spec.ts`

- [ ] **Step 1: Create the failing spec file**

Create `libs/ui/design-system/src/lib/molecules/confirmation-panel/confirmation-panel.component.spec.ts` with this content:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  ConfirmationPanelComponent,
  ConfirmationPanelData,
} from './confirmation-panel.component';

const baseData: ConfirmationPanelData = {
  title: 'Approve User Registration',
  message: 'Approve Jane Doe for access to the portal.',
  confirm: {
    label: 'Approve User',
    tone: 'default',
  },
  cancel: {
    label: 'Cancel',
  },
};

describe('ConfirmationPanelComponent', () => {
  let fixture: ComponentFixture<ConfirmationPanelComponent>;
  let component: ConfirmationPanelComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmationPanelComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmationPanelComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('data', baseData);
    fixture.detectChanges();
  });

  it('renders dialog semantics with labelled title and description', () => {
    const dialog = fixture.nativeElement.querySelector('[data-testid="confirmation-panel"]') as HTMLElement;
    const title = fixture.nativeElement.querySelector('[data-testid="modal-title"]') as HTMLElement;
    const message = fixture.nativeElement.querySelector('[data-testid="modal-message"]') as HTMLElement;

    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe(title.id);
    expect(dialog.getAttribute('aria-describedby')).toBe(message.id);
    expect(title.textContent?.trim()).toBe('Approve User Registration');
    expect(message.textContent?.trim()).toBe('Approve Jane Doe for access to the portal.');
  });

  it('renders preserved action test ids and labels', () => {
    const cancel = fixture.nativeElement.querySelector('[data-testid="modal-cancel-button"]') as HTMLButtonElement;
    const confirm = fixture.nativeElement.querySelector('[data-testid="modal-confirm-button"]') as HTMLButtonElement;

    expect(cancel.textContent?.trim()).toBe('Cancel');
    expect(confirm.textContent?.trim()).toBe('Approve User');
  });

  it('emits a typed confirm action once when enabled', () => {
    const spy = vi.fn();
    component.actionSelected.subscribe(spy);

    const confirm = fixture.nativeElement.querySelector('[data-testid="modal-confirm-button"]') as HTMLButtonElement;
    confirm.click();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ action: 'confirm' });
  });

  it('emits a typed cancel action once when enabled', () => {
    const spy = vi.fn();
    component.actionSelected.subscribe(spy);

    const cancel = fixture.nativeElement.querySelector('[data-testid="modal-cancel-button"]') as HTMLButtonElement;
    cancel.click();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ action: 'cancel' });
  });

  it('treats loading as higher priority than disabled and suppresses duplicate confirms', () => {
    const spy = vi.fn();
    component.actionSelected.subscribe(spy);
    fixture.componentRef.setInput('data', {
      ...baseData,
      confirm: {
        label: 'Approve User',
        tone: 'default',
        disabled: true,
        loading: true,
      },
    } satisfies ConfirmationPanelData);
    fixture.detectChanges();

    const confirm = fixture.nativeElement.querySelector('[data-testid="modal-confirm-button"]') as HTMLButtonElement;
    confirm.click();
    confirm.click();

    expect(confirm.disabled).toBe(true);
    expect(confirm.textContent).toContain('Working');
    expect(spy).not.toHaveBeenCalled();
  });

  it('suppresses rapid duplicate confirm actions after the first click', () => {
    const spy = vi.fn();
    component.actionSelected.subscribe(spy);

    const confirm = fixture.nativeElement.querySelector('[data-testid="modal-confirm-button"]') as HTMLButtonElement;
    confirm.click();
    confirm.click();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('suppresses rapid duplicate cancel actions after the first click', () => {
    const spy = vi.fn();
    component.actionSelected.subscribe(spy);

    const cancel = fixture.nativeElement.querySelector('[data-testid="modal-cancel-button"]') as HTMLButtonElement;
    cancel.click();
    cancel.click();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('falls back empty labels and text to safe defaults', () => {
    fixture.componentRef.setInput('data', {
      title: '   ',
      message: '',
      confirm: { label: '   ' },
      cancel: { label: '' },
    } satisfies ConfirmationPanelData);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="modal-title"]').textContent.trim()).toBe('Confirm action');
    expect(fixture.nativeElement.querySelector('[data-testid="modal-message"]').textContent.trim()).toBe('Please review this action before continuing.');
    expect(fixture.nativeElement.querySelector('[data-testid="modal-confirm-button"]').textContent.trim()).toBe('Confirm');
    expect(fixture.nativeElement.querySelector('[data-testid="modal-cancel-button"]').textContent.trim()).toBe('Cancel');
  });

  it('clamps title and message length at the documented boundary', () => {
    const title = 'T'.repeat(121);
    const message = 'M'.repeat(501);
    fixture.componentRef.setInput('data', {
      ...baseData,
      title,
      message,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="modal-title"]').textContent.trim()).toHaveLength(120);
    expect(fixture.nativeElement.querySelector('[data-testid="modal-message"]').textContent.trim()).toHaveLength(500);

    fixture.componentRef.setInput('data', {
      ...baseData,
      title: 'T'.repeat(120),
      message: 'M'.repeat(500),
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="modal-title"]').textContent.trim()).toHaveLength(120);
    expect(fixture.nativeElement.querySelector('[data-testid="modal-message"]').textContent.trim()).toHaveLength(500);
  });

  it('renders untrusted text as text and not HTML', () => {
    fixture.componentRef.setInput('data', {
      ...baseData,
      title: '<img src=x onerror=alert(1)>Title',
      message: '<script>alert(1)</script>',
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="modal-title"]').textContent).toContain('<img src=x onerror=alert(1)>Title');
    expect(fixture.nativeElement.querySelector('[data-testid="modal-message"]').textContent).toContain('<script>alert(1)</script>');
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.querySelector('script')).toBeNull();
    expect(fixture.nativeElement.querySelector('[innerHTML]')).toBeNull();
  });

  it('falls back invalid tone and initialFocus values to safe defaults', () => {
    fixture.componentRef.setInput('data', {
      ...baseData,
      confirm: {
        label: 'Approve User',
        tone: 'invalid' as never,
      },
      initialFocus: 'invalid' as never,
    });
    fixture.detectChanges();

    const confirm = fixture.nativeElement.querySelector('[data-testid="modal-confirm-button"]') as HTMLButtonElement;

    expect(confirm.className).toContain('bg-blue-600');
    expect(component.initialFocusTarget()).toBe('confirm');
  });

  it('defaults initial focus to cancel for danger tone', () => {
    fixture.componentRef.setInput('data', {
      ...baseData,
      confirm: {
        label: 'Delete User',
        tone: 'danger',
      },
    });
    fixture.detectChanges();

    expect(component.initialFocusTarget()).toBe('cancel');
  });

  it('does not render inline style attributes', () => {
    expect(fixture.nativeElement.querySelector('[style]')).toBeNull();
  });

  it('does not import CDK dialog, overlay, focus, or Material primitives', () => {
    const source = readFileSync(new URL('./confirmation-panel.component.ts', import.meta.url), 'utf8');

    expect(source).not.toContain('@angular/cdk/dialog');
    expect(source).not.toContain('@angular/cdk/overlay');
    expect(source).not.toContain('@angular/cdk/a11y');
    expect(source).not.toContain('@angular/material');
    expect(source).not.toContain('DialogRef');
    expect(source).not.toContain('DIALOG_DATA');
    expect(source).not.toContain('FocusTrap');
    expect(source).not.toContain('OverlayModule');
  });
});
```

- [ ] **Step 2: Run the focused design-system test and verify it fails**

Run:

```bash
npx nx test design-system --include=src/lib/molecules/confirmation-panel/confirmation-panel.component.spec.ts --skip-nx-cache
```

Expected: FAIL because `./confirmation-panel.component` does not exist yet.

- [ ] **Step 3: Keep the failing test uncommitted until the implementation passes**

Run:

```bash
git status --short libs/ui/design-system/src/lib/molecules/confirmation-panel
```

Expected: the new failing spec is present in the worktree. Do not commit a red state.

---

### Task 2: Implement the Generic Confirmation Panel

**Files:**
- Create: `libs/ui/design-system/src/lib/molecules/confirmation-panel/confirmation-panel.component.ts`
- Create: `libs/ui/design-system/src/lib/molecules/confirmation-panel/confirmation-panel.component.html`
- Create: `libs/ui/design-system/src/lib/molecules/confirmation-panel/confirmation-panel.component.scss`
- Modify: `libs/ui/design-system/src/index.ts`

- [ ] **Step 1: Add the component class**

Create `libs/ui/design-system/src/lib/molecules/confirmation-panel/confirmation-panel.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ConfirmationTone = 'default' | 'danger';
export type ConfirmationActionId = 'confirm' | 'cancel';
export type ConfirmationInitialFocus = 'confirm' | 'cancel';

export interface ConfirmationPanelAction {
  label: string;
  tone?: ConfirmationTone;
  disabled?: boolean;
  loading?: boolean;
}

export interface ConfirmationPanelData {
  title: string;
  message: string;
  confirm: ConfirmationPanelAction;
  cancel: Omit<ConfirmationPanelAction, 'tone' | 'loading'>;
  ariaLabel?: string;
  initialFocus?: ConfirmationInitialFocus;
}

export interface ConfirmationPanelActionSelected {
  action: ConfirmationActionId;
}

const DEFAULT_TITLE = 'Confirm action';
const DEFAULT_MESSAGE = 'Please review this action before continuing.';
const DEFAULT_CONFIRM = 'Confirm';
const DEFAULT_CANCEL = 'Cancel';
const MAX_TITLE_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 500;

@Component({
  selector: 'tai-confirmation-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirmation-panel.component.html',
  styleUrl: './confirmation-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmationPanelComponent {
  readonly data = input.required<ConfirmationPanelData>();
  readonly actionSelected = output<ConfirmationPanelActionSelected>();

  private readonly emittedAction = signal<ConfirmationActionId | null>(null);

  protected readonly titleId = 'confirmation-panel-title';
  protected readonly messageId = 'confirmation-panel-message';

  protected readonly viewModel = computed(() => {
    const data = this.data();
    const tone = data.confirm?.tone === 'danger' ? 'danger' : 'default';
    const confirmLoading = data.confirm?.loading === true;
    const confirmDisabled = confirmLoading || data.confirm?.disabled === true;
    const initialFocus = data.initialFocus === 'confirm' || data.initialFocus === 'cancel'
      ? data.initialFocus
      : tone === 'danger'
        ? 'cancel'
        : 'confirm';

    return {
      title: this.normalizeText(data.title, DEFAULT_TITLE, MAX_TITLE_LENGTH),
      message: this.normalizeText(data.message, DEFAULT_MESSAGE, MAX_MESSAGE_LENGTH),
      confirmLabel: this.normalizeText(data.confirm?.label, DEFAULT_CONFIRM, MAX_TITLE_LENGTH),
      cancelLabel: this.normalizeText(data.cancel?.label, DEFAULT_CANCEL, MAX_TITLE_LENGTH),
      ariaLabel: this.normalizeText(data.ariaLabel, this.normalizeText(data.title, DEFAULT_TITLE, MAX_TITLE_LENGTH), MAX_TITLE_LENGTH),
      tone,
      confirmLoading,
      confirmDisabled,
      cancelDisabled: data.cancel?.disabled === true || confirmLoading,
      initialFocus,
    };
  });

  initialFocusTarget(): ConfirmationInitialFocus {
    return this.viewModel().initialFocus;
  }

  protected confirmButtonClasses(): string {
    const base =
      'inline-flex min-h-11 items-center justify-center rounded-md px-5 py-2.5 text-sm font-semibold text-white shadow-sm outline-none transition-colors duration-200 focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-60';
    const toneClasses =
      this.viewModel().tone === 'danger'
        ? ' bg-red-700 hover:bg-red-800 focus-visible:ring-red-700/25'
        : ' bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-600/25';

    return `${base}${toneClasses}`;
  }

  protected cancelButtonClasses(): string {
    return 'inline-flex min-h-11 items-center justify-center rounded-md border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 outline-none transition-colors duration-200 hover:bg-gray-50 focus-visible:border-blue-600 focus-visible:ring-3 focus-visible:ring-blue-600/20 disabled:cursor-not-allowed disabled:opacity-60';
  }

  protected select(action: ConfirmationActionId): void {
    if (this.emittedAction() !== null) {
      return;
    }

    const vm = this.viewModel();
    if (action === 'confirm' && vm.confirmDisabled) {
      return;
    }
    if (action === 'cancel' && vm.cancelDisabled) {
      return;
    }

    this.emittedAction.set(action);
    this.actionSelected.emit({ action });
  }

  private normalizeText(value: string | undefined, fallback: string, maxLength: number): string {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    const normalized = trimmed.length > 0 ? trimmed : fallback;
    return normalized.slice(0, maxLength);
  }
}
```

- [ ] **Step 2: Add the template**

Create `libs/ui/design-system/src/lib/molecules/confirmation-panel/confirmation-panel.component.html`:

```html
@let vm = viewModel();

<section
  class="mx-auto w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-xl"
  role="dialog"
  aria-modal="true"
  [attr.aria-label]="vm.ariaLabel"
  [attr.aria-labelledby]="titleId"
  [attr.aria-describedby]="messageId"
  data-testid="confirmation-panel"
>
  <h2
    class="text-xl font-bold text-gray-900"
    [id]="titleId"
    data-testid="modal-title"
    [textContent]="vm.title"
  ></h2>

  <p
    class="mt-2 text-sm leading-6 text-gray-600"
    [id]="messageId"
    data-testid="modal-message"
    [textContent]="vm.message"
  ></p>

  @if (vm.tone === 'danger') {
    <p class="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
      This action requires careful review.
    </p>
  }

  <div class="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
    <button
      type="button"
      [class]="cancelButtonClasses()"
      [disabled]="vm.cancelDisabled"
      (click)="select('cancel')"
      data-confirmation-focus="cancel"
      data-testid="modal-cancel-button"
    >
      <span [textContent]="vm.cancelLabel"></span>
    </button>

    <button
      type="button"
      [class]="confirmButtonClasses()"
      [disabled]="vm.confirmDisabled"
      (click)="select('confirm')"
      data-confirmation-focus="confirm"
      data-testid="modal-confirm-button"
    >
      <span [textContent]="vm.confirmLoading ? 'Working...' : vm.confirmLabel"></span>
    </button>
  </div>
</section>
```

- [ ] **Step 3: Add the stylesheet**

Create `libs/ui/design-system/src/lib/molecules/confirmation-panel/confirmation-panel.component.scss`:

```scss
:host {
  display: block;
}

@media (prefers-reduced-motion: reduce) {
  :host * {
    transition-duration: 0.01ms;
  }
}
```

- [ ] **Step 4: Export the new panel**

Modify `libs/ui/design-system/src/index.ts` by adding this export beside the existing confirmation dialog export:

```typescript
export * from './lib/molecules/confirmation-panel/confirmation-panel.component';
```

- [ ] **Step 5: Run the focused design-system test**

Run:

```bash
npx nx test design-system --include=src/lib/molecules/confirmation-panel/confirmation-panel.component.spec.ts --skip-nx-cache
```

Expected: PASS for `ConfirmationPanelComponent`.

- [ ] **Step 6: Run all design-system tests**

Run:

```bash
npx nx test design-system --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 7: Commit the panel**

```bash
git add libs/ui/design-system/src/lib/molecules/confirmation-panel libs/ui/design-system/src/index.ts
git commit -m "feat: add generic confirmation panel"
```

---

### Task 3: Add Confirmation Panel Stories

**Files:**
- Create: `libs/ui/design-system/src/lib/molecules/confirmation-panel/confirmation-panel.stories.ts`

- [ ] **Step 1: Add stories with interaction checks**

Create `libs/ui/design-system/src/lib/molecules/confirmation-panel/confirmation-panel.stories.ts`:

```typescript
import { Meta, StoryObj } from '@storybook/angular';
import { expect, fn, userEvent, within } from '@storybook/test';
import {
  ConfirmationPanelComponent,
  ConfirmationPanelData,
} from './confirmation-panel.component';

const baseData: ConfirmationPanelData = {
  title: 'Approve User Registration',
  message:
    'Approve Jane Doe for access to the portal. This will grant platform access immediately.',
  confirm: {
    label: 'Approve User',
    tone: 'default',
  },
  cancel: {
    label: 'Cancel',
  },
};

const meta: Meta<ConfirmationPanelComponent> = {
  title: 'Molecules/Confirmation',
  component: ConfirmationPanelComponent,
  args: {
    data: baseData,
    actionSelected: fn(),
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<ConfirmationPanelComponent>;

export const Default: Story = {};

export const Danger: Story = {
  args: {
    data: {
      title: 'Delete User Account',
      message:
        'This action is permanent and cannot be undone. The user will lose access immediately.',
      confirm: {
        label: 'Delete Account',
        tone: 'danger',
      },
      cancel: {
        label: 'Keep Account',
      },
    } satisfies ConfirmationPanelData,
  },
};

export const LongMessage: Story = {
  args: {
    data: {
      title: 'Review administrative approval with a long but bounded heading',
      message:
        'This confirmation intentionally uses a longer message to verify wrapping behavior across narrow and wide layouts without overlapping adjacent content or hiding the action buttons from the user.',
      confirm: {
        label: 'Approve User',
        tone: 'default',
      },
      cancel: {
        label: 'Cancel',
      },
    } satisfies ConfirmationPanelData,
  },
};

export const Loading: Story = {
  args: {
    data: {
      ...baseData,
      confirm: {
        label: 'Approve User',
        tone: 'default',
        loading: true,
      },
    } satisfies ConfirmationPanelData,
  },
};

export const SecurityText: Story = {
  args: {
    data: {
      title: '<img src=x onerror=alert(1)>Confirm',
      message: '<script>alert(1)</script>',
      confirm: {
        label: 'Confirm',
        tone: 'default',
      },
      cancel: {
        label: 'Cancel',
      },
    } satisfies ConfirmationPanelData,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByTestId('modal-title')).toHaveTextContent('<img src=x onerror=alert(1)>Confirm');
    await expect(canvas.getByTestId('modal-message')).toHaveTextContent('<script>alert(1)</script>');
    await expect(canvasElement.querySelector('img')).toBeNull();
    await expect(canvasElement.querySelector('script')).toBeNull();
  },
};

export const InteractionAudit: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('dialog')).toBeInTheDocument();
    await userEvent.click(canvas.getByTestId('modal-cancel-button'));
    await expect(args.actionSelected).toHaveBeenCalledWith({ action: 'cancel' });
  },
};
```

- [ ] **Step 2: Run Storybook build**

Run:

```bash
npx nx build-storybook design-system --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 3: Run Storybook interaction tests if target is inferred**

Run:

```bash
npx nx test-storybook design-system --skip-nx-cache
```

Expected: PASS. If Nx reports that `test-storybook` is not available, record the exact message in the implementation notes and rely on `build-storybook` plus unit tests for this PR.

- [ ] **Step 4: Commit stories**

```bash
git add libs/ui/design-system/src/lib/molecules/confirmation-panel/confirmation-panel.stories.ts
git commit -m "docs: add confirmation panel stories"
```

---

### Task 4: Refactor ConfirmationDialogComponent into a Compatibility Wrapper

**Files:**
- Modify: `libs/ui/design-system/src/lib/molecules/confirmation-dialog/confirmation-dialog.ts`
- Modify: `libs/ui/design-system/src/lib/molecules/confirmation-dialog/confirmation-dialog.html`
- Modify: `libs/ui/design-system/src/lib/molecules/confirmation-dialog/confirmation-dialog.spec.ts`
- Modify: `libs/ui/design-system/src/lib/molecules/confirmation-dialog/confirmation-dialog.stories.ts`

- [ ] **Step 1: Replace wrapper tests**

Replace `libs/ui/design-system/src/lib/molecules/confirmation-dialog/confirmation-dialog.spec.ts` with:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import {
  ConfirmationDialogComponent,
  ConfirmationDialogData,
} from './confirmation-dialog';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ConfirmationDialogComponent compatibility wrapper', () => {
  let fixture: ComponentFixture<ConfirmationDialogComponent>;
  let mockDialogRef: { close: (result?: boolean) => void };

  const mockData: ConfirmationDialogData = {
    title: 'Approve User Registration',
    message: 'Approve Jane Doe for access to the portal.',
    confirmText: 'Approve User',
    cancelText: 'Cancel',
    confirmButtonClass: 'bg-indigo-600 hover:bg-indigo-700',
  };

  beforeEach(async () => {
    mockDialogRef = {
      close: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ConfirmationDialogComponent],
      providers: [
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: DIALOG_DATA, useValue: mockData },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmationDialogComponent);
    fixture.detectChanges();
  });

  it('renders the deprecated tai-confirmation-dialog wrapper through tai-confirmation-panel', () => {
    expect(fixture.nativeElement.querySelector('tai-confirmation-panel')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="modal-title"]').textContent.trim()).toBe('Approve User Registration');
    expect(fixture.nativeElement.querySelector('[data-testid="modal-message"]').textContent.trim()).toBe('Approve Jane Doe for access to the portal.');
  });

  it('maps legacy confirm and cancel labels', () => {
    expect(fixture.nativeElement.querySelector('[data-testid="modal-confirm-button"]').textContent.trim()).toBe('Approve User');
    expect(fixture.nativeElement.querySelector('[data-testid="modal-cancel-button"]').textContent.trim()).toBe('Cancel');
  });

  it('ignores legacy confirmButtonClass instead of applying caller classes', () => {
    const confirm = fixture.nativeElement.querySelector('[data-testid="modal-confirm-button"]') as HTMLButtonElement;

    expect(confirm.className).not.toContain('bg-indigo-600');
    expect(confirm.className).not.toContain('hover:bg-indigo-700');
    expect(confirm.className).toContain('bg-blue-600');
  });

  it('closes the legacy DialogRef with true on confirm', () => {
    const confirm = fixture.nativeElement.querySelector('[data-testid="modal-confirm-button"]') as HTMLButtonElement;
    confirm.click();

    expect(mockDialogRef.close).toHaveBeenCalledWith(true);
  });

  it('closes the legacy DialogRef with false on cancel', () => {
    const cancel = fixture.nativeElement.querySelector('[data-testid="modal-cancel-button"]') as HTMLButtonElement;
    cancel.click();

    expect(mockDialogRef.close).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: Run the wrapper test and verify it fails**

Run:

```bash
npx nx test design-system --include=src/lib/molecules/confirmation-dialog/confirmation-dialog.spec.ts --skip-nx-cache
```

Expected: FAIL because the wrapper still renders the old template and applies `confirmButtonClass`.

- [ ] **Step 3: Replace the wrapper class**

Replace `libs/ui/design-system/src/lib/molecules/confirmation-dialog/confirmation-dialog.ts` with:

```typescript
import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import {
  ConfirmationPanelActionSelected,
  ConfirmationPanelComponent,
  ConfirmationPanelData,
} from '../confirmation-panel/confirmation-panel.component';

export interface ConfirmationDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /**
   * @deprecated Caller-provided classes are ignored. Use typed confirmation tones
   * through ConfirmationPanelComponent for new code.
   */
  confirmButtonClass?: string;
}

/**
 * @deprecated Use ConfirmationPanelComponent inside a feature-owned modal host.
 * This wrapper preserves the old tai-confirmation-dialog selector and DialogRef
 * contract for existing CDK Dialog consumers during migration.
 */
@Component({
  selector: 'tai-confirmation-dialog',
  standalone: true,
  imports: [CommonModule, ConfirmationPanelComponent],
  templateUrl: './confirmation-dialog.html',
  styleUrl: './confirmation-dialog.scss',
})
export class ConfirmationDialogComponent {
  private readonly dialogRef = inject(DialogRef<boolean>);
  readonly data = inject<ConfirmationDialogData>(DIALOG_DATA);

  protected readonly panelData = computed<ConfirmationPanelData>(() => ({
    title: this.data.title,
    message: this.data.message,
    confirm: {
      label: this.data.confirmText ?? 'Confirm',
      tone: 'default',
    },
    cancel: {
      label: this.data.cancelText ?? 'Cancel',
    },
  }));

  protected onActionSelected(event: ConfirmationPanelActionSelected): void {
    this.dialogRef.close(event.action === 'confirm');
  }
}
```

- [ ] **Step 4: Replace the wrapper template**

Replace `libs/ui/design-system/src/lib/molecules/confirmation-dialog/confirmation-dialog.html` with:

```html
<tai-confirmation-panel
  [data]="panelData()"
  (actionSelected)="onActionSelected($event)"
/>
```

- [ ] **Step 5: Update compatibility stories**

Replace `libs/ui/design-system/src/lib/molecules/confirmation-dialog/confirmation-dialog.stories.ts` with:

```typescript
import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import {
  ConfirmationDialogComponent,
  ConfirmationDialogData,
} from './confirmation-dialog';
import { fn } from '@storybook/test';

const meta: Meta<ConfirmationDialogComponent> = {
  title: 'Molecules/ConfirmationDialogDeprecated',
  component: ConfirmationDialogComponent,
  decorators: [
    moduleMetadata({
      providers: [
        { provide: DialogRef, useValue: { close: fn() } },
        {
          provide: DIALOG_DATA,
          useValue: {
            title: 'Confirm Action',
            message:
              'This deprecated wrapper preserves the legacy tai-confirmation-dialog selector during migration.',
            confirmText: 'Confirm',
            cancelText: 'Cancel',
            confirmButtonClass: 'bg-indigo-600 hover:bg-indigo-700',
          } satisfies ConfirmationDialogData,
        },
      ],
    }),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<ConfirmationDialogComponent>;

export const CompatibilityWrapper: Story = {};
```

- [ ] **Step 6: Run design-system tests**

Run:

```bash
npx nx test design-system --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 7: Commit compatibility wrapper**

```bash
git add libs/ui/design-system/src/lib/molecules/confirmation-dialog
git commit -m "refactor: wrap legacy confirmation dialog"
```

---

### Task 5: Add UsersConfirmationHostComponent Tests

**Files:**
- Create: `apps/portal-web/src/app/features/users/users-confirmation-host.component.spec.ts`

- [ ] **Step 1: Create the failing host spec**

Create `apps/portal-web/src/app/features/users/users-confirmation-host.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { UsersConfirmationHostComponent } from './users-confirmation-host.component';
import { User } from './users.service';

const pendingUser: User = {
  id: 'user-1',
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  status: 'PendingApproval',
  rowVersion: 42,
};

describe('UsersConfirmationHostComponent', () => {
  let fixture: ComponentFixture<UsersConfirmationHostComponent>;
  let component: UsersConfirmationHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UsersConfirmationHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(UsersConfirmationHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('opens with approval content and default focus on confirm', async () => {
    const promise = component.confirmApproval(pendingUser);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="modal-title"]').textContent).toContain('Approve User Registration');
    expect(fixture.nativeElement.querySelector('[data-testid="modal-message"]').textContent).toContain('jane@example.com');
    expect(component.isOpen()).toBe(true);
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('[data-testid="modal-confirm-button"]'));

    component.handlePanelAction({ action: 'cancel' });
    await expect(promise).resolves.toBe(false);
  });

  it('maps confirm action to true and cancel action to false', async () => {
    const confirmPromise = component.confirmApproval(pendingUser);
    fixture.detectChanges();
    component.handlePanelAction({ action: 'confirm' });
    await expect(confirmPromise).resolves.toBe(true);

    const cancelPromise = component.confirmApproval(pendingUser);
    fixture.detectChanges();
    component.handlePanelAction({ action: 'cancel' });
    await expect(cancelPromise).resolves.toBe(false);
  });

  it('maps Escape and backdrop click to false', async () => {
    const escapePromise = component.confirmApproval(pendingUser);
    fixture.detectChanges();
    component.onKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
    await expect(escapePromise).resolves.toBe(false);

    const backdropPromise = component.confirmApproval(pendingUser);
    fixture.detectChanges();
    const backdrop = fixture.nativeElement.querySelector('[data-testid="users-confirmation-backdrop"]') as HTMLElement;
    backdrop.click();
    await expect(backdropPromise).resolves.toBe(false);
  });

  it('loops Tab and Shift+Tab focus inside the host', async () => {
    const promise = component.confirmApproval(pendingUser);
    fixture.detectChanges();
    await fixture.whenStable();

    const cancel = fixture.nativeElement.querySelector('[data-testid="modal-cancel-button"]') as HTMLButtonElement;
    const confirm = fixture.nativeElement.querySelector('[data-testid="modal-confirm-button"]') as HTMLButtonElement;

    confirm.focus();
    component.onKeydown(new KeyboardEvent('keydown', { key: 'Tab' }));
    expect(document.activeElement).toBe(cancel);

    cancel.focus();
    component.onKeydown(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }));
    expect(document.activeElement).toBe(confirm);

    component.handlePanelAction({ action: 'cancel' });
    await expect(promise).resolves.toBe(false);
  });

  it('restores focus to opener after close', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const promise = component.confirmApproval(pendingUser);
    fixture.detectChanges();
    component.handlePanelAction({ action: 'cancel' });

    await expect(promise).resolves.toBe(false);
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('suppresses duplicate confirm while loading and clears loading after failure reset', async () => {
    const promise = component.confirmApproval(pendingUser);
    fixture.detectChanges();

    component.setLoading(true);
    component.handlePanelAction({ action: 'confirm' });
    component.handlePanelAction({ action: 'confirm' });
    expect(component.isOpen()).toBe(true);

    component.setLoading(false);
    component.handlePanelAction({ action: 'confirm' });

    await expect(promise).resolves.toBe(true);
  });

  it('does not import CDK focus, dialog, overlay, or Material modules', () => {
    const source = readFileSync(new URL('./users-confirmation-host.component.ts', import.meta.url), 'utf8');

    expect(source).not.toContain('@angular/cdk/dialog');
    expect(source).not.toContain('@angular/cdk/overlay');
    expect(source).not.toContain('@angular/cdk/a11y');
    expect(source).not.toContain('@angular/material');
    expect(source).not.toContain('FocusTrap');
    expect(source).not.toContain('DialogModule');
    expect(source).not.toContain('OverlayModule');
  });
});
```

- [ ] **Step 2: Run the focused users host test and verify it fails**

Run:

```bash
npx nx test portal-web --include=src/app/features/users/users-confirmation-host.component.spec.ts --skip-nx-cache
```

Expected: FAIL because `./users-confirmation-host.component` does not exist yet.

---

### Task 6: Implement UsersConfirmationHostComponent

**Files:**
- Create: `apps/portal-web/src/app/features/users/users-confirmation-host.component.ts`

- [ ] **Step 1: Add the users feature host**

Create `apps/portal-web/src/app/features/users/users-confirmation-host.component.ts`:

```typescript
import { AfterViewChecked, ChangeDetectionStrategy, Component, ElementRef, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ConfirmationPanelActionSelected,
  ConfirmationPanelComponent,
  ConfirmationPanelData,
} from '@tai/ui-design-system';
import { User } from './users.service';

@Component({
  selector: 'app-users-confirmation-host',
  standalone: true,
  imports: [CommonModule, ConfirmationPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isOpen()) {
      <div
        class="fixed inset-0 z-50 flex min-h-dvh items-center justify-center bg-gray-950/45 px-4 py-6"
        data-testid="users-confirmation-backdrop"
        (click)="onBackdropClick($event)"
        (keydown)="onKeydown($event)"
      >
        <div
          class="w-full max-w-md"
          data-testid="users-confirmation-host"
          #hostPanel
          (click)="$event.stopPropagation()"
        >
          <tai-confirmation-panel
            [data]="panelData()"
            (actionSelected)="handlePanelAction($event)"
          />
        </div>
      </div>
    }
  `,
})
export class UsersConfirmationHostComponent implements AfterViewChecked {
  readonly isOpen = signal(false);
  readonly panelData = signal<ConfirmationPanelData>({
    title: 'Approve User Registration',
    message: 'Please review this action before continuing.',
    confirm: {
      label: 'Approve User',
      tone: 'default',
    },
    cancel: {
      label: 'Cancel',
    },
    initialFocus: 'confirm',
  });

  private readonly hostPanel = viewChild<ElementRef<HTMLElement>>('hostPanel');
  private resolver: ((confirmed: boolean) => void) | null = null;
  private opener: HTMLElement | null = null;
  private needsInitialFocus = false;
  private loading = false;

  confirmApproval(user: User): Promise<boolean> {
    if (this.resolver) {
      this.close(false);
    }

    this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.loading = false;
    this.panelData.set({
      title: 'Approve User Registration',
      message: `Are you sure you want to approve the registration for ${user.firstName} ${user.lastName} (${user.email})? This will grant them access to the platform immediately.`,
      confirm: {
        label: 'Approve User',
        tone: 'default',
      },
      cancel: {
        label: 'Cancel',
      },
      initialFocus: 'confirm',
    });
    this.isOpen.set(true);
    this.needsInitialFocus = true;

    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  ngAfterViewChecked(): void {
    if (!this.needsInitialFocus) {
      return;
    }

    this.needsInitialFocus = false;
    queueMicrotask(() => this.focusInitialElement());
  }

  setLoading(loading: boolean): void {
    this.loading = loading;
    const current = this.panelData();
    this.panelData.set({
      ...current,
      confirm: {
        ...current.confirm,
        loading,
      },
    });
  }

  handlePanelAction(event: ConfirmationPanelActionSelected): void {
    if (event.action === 'confirm') {
      if (this.loading) {
        return;
      }
      this.close(true);
      return;
    }

    this.close(false);
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close(false);
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close(false);
      return;
    }

    if (event.key === 'Tab') {
      this.loopFocus(event);
    }
  }

  private close(confirmed: boolean): void {
    const resolver = this.resolver;
    this.resolver = null;
    this.loading = false;
    this.isOpen.set(false);
    resolver?.(confirmed);
    this.restoreFocus();
  }

  private focusInitialElement(): void {
    const host = this.hostPanel()?.nativeElement;
    if (!host) {
      return;
    }

    const target = host.querySelector<HTMLElement>('[data-confirmation-focus="confirm"]')
      ?? this.focusableElements(host)[0];
    target?.focus();
  }

  private loopFocus(event: KeyboardEvent): void {
    const host = this.hostPanel()?.nativeElement;
    if (!host) {
      return;
    }

    const focusable = this.focusableElements(host);
    if (focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private focusableElements(host: HTMLElement): HTMLElement[] {
    return Array.from(
      host.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
  }

  private restoreFocus(): void {
    if (this.opener?.isConnected) {
      this.opener.focus();
    }
    this.opener = null;
  }
}
```

- [ ] **Step 2: Run focused host tests**

Run:

```bash
npx nx test portal-web --include=src/app/features/users/users-confirmation-host.component.spec.ts --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 3: Commit host component**

```bash
git add apps/portal-web/src/app/features/users/users-confirmation-host.component.ts apps/portal-web/src/app/features/users/users-confirmation-host.component.spec.ts
git commit -m "feat: add users confirmation host"
```

---

### Task 7: Migrate UsersPage Away from CDK Dialog

**Files:**
- Modify: `apps/portal-web/src/app/features/users/users.page.ts`
- Modify: `apps/portal-web/src/app/features/users/users.page.spec.ts`

- [ ] **Step 1: Replace users page tests**

In `apps/portal-web/src/app/features/users/users.page.spec.ts`:

- Remove imports for `Dialog` and `DialogModule`.
- Remove `mockDialog`.
- Add tests for confirm true and false paths.

Use this approval test block:

```typescript
  it('triggers approval through the local confirmation host when confirmed', async () => {
    const testUser: User = {
      id: 'user-1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      status: 'PendingApproval',
      rowVersion: 123,
    };

    const host = fixture.debugElement.query(By.css('app-users-confirmation-host')).componentInstance;
    vi.spyOn(host, 'confirmApproval').mockResolvedValue(true);

    component['onAction']({ actionId: 'approve', row: testUser });
    await fixture.whenStable();

    expect(host.confirmApproval).toHaveBeenCalledWith(testUser);
    expect(mockStore.approveUser).toHaveBeenCalledWith('user-1', 123);
  });

  it('does not approve when the local confirmation host resolves false', async () => {
    const testUser: User = {
      id: 'user-1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      status: 'PendingApproval',
      rowVersion: 123,
    };

    const host = fixture.debugElement.query(By.css('app-users-confirmation-host')).componentInstance;
    vi.spyOn(host, 'confirmApproval').mockResolvedValue(false);

    component['onAction']({ actionId: 'approve', row: testUser });
    await fixture.whenStable();

    expect(host.confirmApproval).toHaveBeenCalledWith(testUser);
    expect(mockStore.approveUser).not.toHaveBeenCalled();
  });
```

Update the `overrideComponent` block to remove CDK providers entirely:

```typescript
.overrideComponent(UsersPage, {
  add: {
    providers: [
      { provide: UsersStore, useValue: mockStore },
      { provide: Router, useValue: mockRouter },
      { provide: ActivatedRoute, useValue: mockActivatedRoute },
    ],
  },
})
```

- [ ] **Step 2: Run the users page test and verify it fails**

Run:

```bash
npx nx test portal-web --include=src/app/features/users/users.page.spec.ts --skip-nx-cache
```

Expected: FAIL because `UsersPage` still imports `DialogModule`, injects `Dialog`, and does not render `app-users-confirmation-host`.

- [ ] **Step 3: Update UsersPage imports and template**

In `apps/portal-web/src/app/features/users/users.page.ts`:

- Remove `Dialog` and `DialogModule` from `@angular/cdk/dialog`.
- Remove `ConfirmationDialogComponent` and `ConfirmationDialogData` from `@tai/ui-design-system`.
- Import `ViewChild` from `@angular/core`.
- Import `UsersConfirmationHostComponent`.
- Add `UsersConfirmationHostComponent` to component imports.
- Render `<app-users-confirmation-host />` after the data table shell.

The top imports should include:

```typescript
import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  DataTableComponent,
  TableColumnDef,
  TableActionDef,
} from '@tai/ui-design-system';
import { UsersConfirmationHostComponent } from './users-confirmation-host.component';
```

The component metadata imports should be:

```typescript
imports: [CommonModule, DataTableComponent, FormsModule, UsersConfirmationHostComponent],
```

Add this host element after the table container:

```html
      <app-users-confirmation-host />
```

Add this field to `UsersPage`:

```typescript
  @ViewChild(UsersConfirmationHostComponent)
  private confirmationHost?: UsersConfirmationHostComponent;
```

- [ ] **Step 4: Replace the approval method**

Replace `confirmApproval(user: User): void` with:

```typescript
  private async confirmApproval(user: User): Promise<void> {
    const confirmed = await this.confirmationHost?.confirmApproval(user);
    if (confirmed) {
      this.store.approveUser(user.id, user.rowVersion);
    }
  }
```

Remove this field:

```typescript
private readonly dialog = inject(Dialog);
```

- [ ] **Step 5: Run focused users page tests**

Run:

```bash
npx nx test portal-web --include=src/app/features/users/users.page.spec.ts --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 6: Verify CDK dialog imports are gone from users page**

Run:

```bash
rg -n "Dialog|DialogModule|DialogRef|DIALOG_DATA|ConfirmationDialogComponent|ConfirmationDialogData|confirmButtonClass" apps/portal-web/src/app/features/users/users.page.ts apps/portal-web/src/app/features/users/users.page.spec.ts
```

Expected: no matches.

- [ ] **Step 7: Run portal-web tests**

Run:

```bash
npx nx test portal-web --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 8: Commit users page migration**

```bash
git add apps/portal-web/src/app/features/users/users.page.ts apps/portal-web/src/app/features/users/users.page.spec.ts
git commit -m "refactor: use local users confirmation host"
```

---

### Task 8: Update Users Approval E2E Selectors

**Files:**
- Modify: `apps/portal-web-e2e/src/users-approval.spec.ts`

- [ ] **Step 1: Replace dialog selector usage**

In `apps/portal-web-e2e/src/users-approval.spec.ts`, replace:

```typescript
    const dialog = page.locator('tai-confirmation-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Approve User Registration');
```

with:

```typescript
    const dialog = page.getByRole('dialog', { name: /Approve User Registration/i });
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('modal-title')).toHaveText('Approve User Registration');
    await expect(page.getByTestId('modal-message')).toContainText(testEmail);
```

Replace:

```typescript
    await expect(dialog).toBeHidden();
```

with:

```typescript
    await expect(dialog).toBeHidden();
    await expect(page.locator('tai-confirmation-dialog')).toHaveCount(0);
```

- [ ] **Step 2: Verify no migrated E2E selector uses `tai-confirmation-dialog` as the dialog query**

Run:

```bash
rg -n "locator\\('tai-confirmation-dialog'\\)|locator\\(\\\"tai-confirmation-dialog\\\"\\)" apps/portal-web-e2e/src/users-approval.spec.ts
```

Expected: one match is allowed only for `toHaveCount(0)` after close. There must be no visibility query against `tai-confirmation-dialog`.

- [ ] **Step 3: Run or document E2E verification**

Run:

```bash
npx nx e2e portal-web-e2e --grep "Users Approval Workflow" --skip-nx-cache
```

Expected: PASS if local API and auth test setup are available. If the local API/auth setup is not running, capture the exact failure and run the unit-level portal checks from Task 7 instead.

- [ ] **Step 4: Commit E2E update**

```bash
git add apps/portal-web-e2e/src/users-approval.spec.ts
git commit -m "test: query users confirmation by role"
```

---

### Task 9: Add CI-Enforced Static Boundary Scan

**Files:**
- Create: `tools/check-confirmation-boundary.sh`
- Modify: `package.json`
- Modify: `.github/workflows/main.yml`

- [ ] **Step 1: Add the scan script**

Create `tools/check-confirmation-boundary.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

panel_matches="$(rg -n "from '@angular/cdk/dialog'|from \"@angular/cdk/dialog\"|from '@angular/cdk/overlay'|from \"@angular/cdk/overlay\"|from '@angular/cdk/a11y'|from \"@angular/cdk/a11y\"|from '@angular/material|from \"@angular/material|DialogRef|DIALOG_DATA|FocusTrap|OverlayModule|MatDialog" libs/ui/design-system/src/lib/molecules/confirmation-panel apps/portal-web/src/app/features/users/users-confirmation-host.component.ts || true)"

if [[ -n "$panel_matches" ]]; then
  echo "Banned CDK/Material confirmation boundary import found:"
  echo "$panel_matches"
  exit 1
fi

echo "Confirmation boundary scan passed."
```

- [ ] **Step 2: Make the script executable**

Run:

```bash
chmod +x tools/check-confirmation-boundary.sh
```

Expected: command exits 0.

- [ ] **Step 3: Add package script**

Modify `package.json` scripts from:

```json
"scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
}
```

to:

```json
"scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "check:confirmation-boundary": "tools/check-confirmation-boundary.sh"
}
```

- [ ] **Step 4: Run the boundary scan**

Run:

```bash
npm run check:confirmation-boundary
```

Expected: PASS with `Confirmation boundary scan passed.`

- [ ] **Step 5: Verify CI integration path**

In `.github/workflows/main.yml`, add this step immediately after `Lint Affected`:

```yaml
      - name: Confirmation Boundary Scan
        run: npm run check:confirmation-boundary
```

Run:

```bash
npx nx run-many -t lint --projects=design-system,portal-web --skip-nx-cache
npm run check:confirmation-boundary
```

Expected: both commands PASS.

- [ ] **Step 6: Commit boundary scan**

```bash
git add tools/check-confirmation-boundary.sh package.json .github/workflows/main.yml
git commit -m "chore: enforce confirmation boundary scan"
```

---

### Task 10: Final Verification

**Files:**
- No code changes expected unless verification reveals a defect.

- [ ] **Step 1: Run static source scans**

Run:

```bash
rg -n "confirmButtonClass|Dialog\\.open<boolean>\\(ConfirmationDialogComponent|locator\\('tai-confirmation-dialog'\\)|locator\\(\"tai-confirmation-dialog\"\\)" apps libs
```

Expected: matches only in the deprecated compatibility wrapper, wrapper tests/stories, and the E2E `toHaveCount(0)` assertion.

Run:

```bash
npm run check:confirmation-boundary
```

Expected: PASS.

- [ ] **Step 2: Run unit tests**

Run:

```bash
npx nx test design-system --skip-nx-cache
npx nx test portal-web --skip-nx-cache
```

Expected: both PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
npx nx run-many -t lint --projects=design-system,portal-web --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 4: Run builds**

Run:

```bash
npx nx build design-system --skip-nx-cache
npx nx build portal-web --skip-nx-cache
```

Expected: both PASS.

- [ ] **Step 5: Run Storybook build**

Run:

```bash
npx nx build-storybook design-system --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 6: Check worktree**

Run:

```bash
git status --short
```

Expected: no uncommitted source changes.

- [ ] **Step 7: Commit verification notes only if files changed**

If verification required code or docs changes, stage the exact files reported by `git status --short`, then commit them. For example, if verification changed only the users host and its spec:

```bash
git add apps/portal-web/src/app/features/users/users-confirmation-host.component.ts apps/portal-web/src/app/features/users/users-confirmation-host.component.spec.ts
git commit -m "fix: complete confirmation boundary verification"
```

If no files changed, do not create an empty commit.

---

## Plan Self-Review

Spec coverage:

- Generic `tai-confirmation-panel`: Task 1 and Task 2.
- Explicit `actionSelected` payload: Task 1 and Task 2.
- No arbitrary `confirmButtonClass`: Task 1, Task 4, Task 7, Task 10.
- Deprecated `tai-confirmation-dialog` wrapper: Task 4.
- Users feature-owned modal host: Task 5 and Task 6.
- Manual focus management with no CDK focus utilities: Task 5, Task 6, Task 9.
- Users page migration away from CDK Dialog: Task 7.
- E2E selector migration away from `tai-confirmation-dialog`: Task 8.
- CI-enforced static scan: Task 9 and Task 10.
- Storybook states: Task 3.
- Full verification: Task 10.

Placeholder scan:

- No `TBD`, `TODO`, "implement later", or "similar to" placeholders.
- Each code-changing task includes exact file paths and concrete code or replacement snippets.

Type consistency:

- `ConfirmationPanelData`, `ConfirmationPanelActionSelected`, `ConfirmationActionId`, and `ConfirmationInitialFocus` are defined in Task 2 and used consistently by later tasks.
- Public selector is consistently `tai-confirmation-panel`.
- Deprecated selector is consistently `tai-confirmation-dialog`.
- Users host result contract is consistently `Promise<boolean>` through `confirmApproval(user)`.
