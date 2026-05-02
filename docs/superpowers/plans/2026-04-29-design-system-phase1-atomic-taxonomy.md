# Design System Phase 1 Atomic Taxonomy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the minimum atom and molecule layer needed to prove the 3-tier design-system taxonomy, then refactor `login-form` and `data-table` so Portal-Web visibly composes atoms into molecules into organisms.

**Architecture:** Keep the public package import stable through `@tai/ui-design-system` while reorganizing internal files into `atoms/`, `molecules/`, `organisms/`, and `directives/`. Build small standalone Angular components that use Tailwind classes compiled at build time, avoid inline styles and `[innerHTML]`, and keep security-sensitive behavior in `secure-input`.

**Tech Stack:** Angular 21 standalone components, Angular forms, Angular CDK table, Tailwind CSS 4, Nx, Vitest, Storybook.

---

## File Structure

Create this tier structure:

```text
libs/ui/design-system/src/lib/
├── atoms/
│   ├── button/
│   │   ├── button.component.ts
│   │   ├── button.component.html
│   │   ├── button.component.scss
│   │   ├── button.component.spec.ts
│   │   └── button.stories.ts
│   ├── checkbox/
│   │   ├── checkbox.component.ts
│   │   ├── checkbox.component.html
│   │   ├── checkbox.component.scss
│   │   ├── checkbox.component.spec.ts
│   │   └── checkbox.stories.ts
│   ├── icon/
│   │   ├── icon.component.ts
│   │   ├── icon.component.html
│   │   ├── icon.component.scss
│   │   ├── icon.component.spec.ts
│   │   └── icon.stories.ts
│   ├── input/
│   │   ├── input.component.ts
│   │   ├── input.component.html
│   │   ├── input.component.scss
│   │   ├── input.component.spec.ts
│   │   └── input.stories.ts
│   ├── label/
│   │   ├── label.component.ts
│   │   ├── label.component.html
│   │   ├── label.component.scss
│   │   ├── label.component.spec.ts
│   │   └── label.stories.ts
│   └── secure-input/
│       ├── secure-input.ts
│       ├── secure-input.html
│       ├── secure-input.scss
│       ├── secure-input.spec.ts
│       ├── secure-input.stories.ts
│       ├── trusted-types.service.ts
│       └── trusted-types.service.spec.ts
├── molecules/
│   ├── form-field/
│   │   ├── form-field.component.ts
│   │   ├── form-field.component.html
│   │   ├── form-field.component.scss
│   │   ├── form-field.component.spec.ts
│   │   └── form-field.stories.ts
│   ├── confirmation-dialog/
│   ├── crypto-unavailable/
│   ├── notification-toggle/
│   ├── pending-approvals-tile/
│   ├── security-alert/
│   └── toast/
├── organisms/
│   ├── app-shell/
│   ├── data-table/
│   ├── login-form/
│   ├── notification-panel/
│   ├── otp-verification-form/
│   ├── registration-form/
│   ├── sidebar/
│   ├── transfer-list/
│   ├── user-profile/
│   └── wizard/
└── directives/
    └── has-privilege.directive.ts
```

Modify these existing files:

```text
libs/ui/design-system/src/index.ts
libs/ui/design-system/src/lib/design-system/secure-input/*
libs/ui/design-system/src/lib/design-system/login-form/*
libs/ui/design-system/src/lib/design-system/data-table/*
libs/ui/design-system/src/lib/design-system/registration-form/*
libs/ui/design-system/src/lib/design-system/otp-verification-form/*
libs/ui/design-system/src/lib/app-shell/*
libs/ui/design-system/src/lib/sidebar/*
libs/ui/design-system/src/lib/user-profile/*
libs/ui/design-system/src/lib/wizard/*
```

Verification commands:

```bash
npx nx test design-system
npx nx lint design-system
npx nx build design-system
npx nx test portal-web
npx nx lint portal-web
npx nx test identity-ui
npx nx lint identity-ui
npx nx test borrower-portal
npx nx lint borrower-portal
npx nx build portal-web
npx nx build identity-ui
npx nx build borrower-portal
npx nx lint portal-web-e2e
npx nx lint identity-ui-e2e
npx nx lint borrower-portal-e2e
npx nx e2e portal-web-e2e
npx nx e2e identity-ui-e2e
npx nx e2e borrower-portal-e2e
```

---

## Task 1: Add Label Atom

**Files:**
- Create: `libs/ui/design-system/src/lib/atoms/label/label.component.ts`
- Create: `libs/ui/design-system/src/lib/atoms/label/label.component.html`
- Create: `libs/ui/design-system/src/lib/atoms/label/label.component.scss`
- Create: `libs/ui/design-system/src/lib/atoms/label/label.component.spec.ts`
- Create: `libs/ui/design-system/src/lib/atoms/label/label.stories.ts`
- Modify: `libs/ui/design-system/src/index.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { LabelComponent } from './label.component';

describe('LabelComponent', () => {
  let fixture: ComponentFixture<LabelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LabelComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LabelComponent);
  });

  it('associates the label with the target control', () => {
    fixture.componentRef.setInput('forId', 'email');
    fixture.componentRef.setInput('text', 'Corporate Email');
    fixture.detectChanges();

    const label = fixture.nativeElement.querySelector('label') as HTMLLabelElement;
    expect(label.getAttribute('for')).toBe('email');
    expect(label.textContent).toContain('Corporate Email');
  });

  it('renders a required marker without injecting HTML', () => {
    fixture.componentRef.setInput('text', 'Password');
    fixture.componentRef.setInput('required', true);
    fixture.detectChanges();

    const marker = fixture.nativeElement.querySelector('[data-testid="required-marker"]');
    expect(marker.textContent.trim()).toBe('*');
    expect(fixture.nativeElement.querySelector('[innerHTML]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx nx test design-system --testFile=label.component.spec.ts`

Expected: FAIL because `LabelComponent` does not exist.

- [ ] **Step 3: Add the component**

```typescript
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'tai-label',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './label.component.html',
  styleUrl: './label.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabelComponent {
  readonly forId = input<string>('');
  readonly text = input.required<string>();
  readonly required = input<boolean>(false);
}
```

```html
<label
  [attr.for]="forId() || null"
  class="tai-label text-sm font-semibold text-gray-700"
>
  <span [textContent]="text()"></span>
  @if (required()) {
    <span
      class="ml-1 text-red-600"
      aria-hidden="true"
      data-testid="required-marker"
    >*</span>
  }
</label>
```

```scss
:host {
  display: inline-flex;
}
```

```typescript
import type { Meta, StoryObj } from '@storybook/angular';
import { LabelComponent } from './label.component';

const meta: Meta<LabelComponent> = {
  title: 'Atoms/Label',
  component: LabelComponent,
  args: {
    forId: 'email',
    text: 'Corporate Email',
    required: false,
  },
};

export default meta;
type Story = StoryObj<LabelComponent>;

export const Default: Story = {};

export const Required: Story = {
  args: {
    text: 'Password',
    required: true,
  },
};
```

- [ ] **Step 4: Export it**

Add this line to `libs/ui/design-system/src/index.ts`:

```typescript
export * from './lib/atoms/label/label.component';
```

- [ ] **Step 5: Run the test**

Run: `npx nx test design-system --testFile=label.component.spec.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/ui/design-system/src/lib/atoms/label libs/ui/design-system/src/index.ts
git commit -m "feat(ui): add label atom"
```

---

## Task 2: Add Input Atom

**Files:**
- Create: `libs/ui/design-system/src/lib/atoms/input/input.component.ts`
- Create: `libs/ui/design-system/src/lib/atoms/input/input.component.html`
- Create: `libs/ui/design-system/src/lib/atoms/input/input.component.scss`
- Create: `libs/ui/design-system/src/lib/atoms/input/input.component.spec.ts`
- Create: `libs/ui/design-system/src/lib/atoms/input/input.stories.ts`
- Modify: `libs/ui/design-system/src/index.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { describe, expect, it, beforeEach } from 'vitest';
import { InputComponent } from './input.component';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent],
  template: `
    <tai-input
      id="email"
      type="email"
      placeholder="name@example.com"
      autocomplete="email"
      [invalid]="true"
      [formControl]="control"
    />
  `,
})
class HostComponent {
  readonly control = new FormControl('', { nonNullable: true });
}

describe('InputComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('renders the configured input attributes', () => {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.id).toBe('email');
    expect(input.type).toBe('email');
    expect(input.placeholder).toBe('name@example.com');
    expect(input.autocomplete).toBe('email');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('writes user input through ControlValueAccessor', () => {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'admin@tai.com';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.componentInstance.control.value).toBe('admin@tai.com');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx nx test design-system --testFile=input.component.spec.ts`

Expected: FAIL because `InputComponent` does not exist.

- [ ] **Step 3: Add the component**

```typescript
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export type TaiInputType = 'text' | 'email' | 'password' | 'search' | 'number';

@Component({
  selector: 'tai-input',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './input.component.html',
  styleUrl: './input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputComponent),
      multi: true,
    },
  ],
})
export class InputComponent implements ControlValueAccessor {
  readonly id = input<string>('');
  readonly type = input<TaiInputType>('text');
  readonly placeholder = input<string>('');
  readonly autocomplete = input<string>('off');
  readonly invalid = input<boolean>(false);
  readonly describedBy = input<string>('');
  readonly value = input<string | null>(null);
  readonly valueChanged = output<string>();
  readonly blurred = output<void>();

  protected readonly controlValue = signal<string>('');
  protected readonly disabled = signal<boolean>(false);
  protected readonly displayValue = computed(() => this.value() ?? this.controlValue());

  protected readonly inputClasses = computed(() => {
    const base =
      'tai-input w-full rounded-md border bg-white px-4 py-3 text-base text-gray-900 shadow-sm outline-none transition-colors duration-200 placeholder:text-gray-400 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400';
    const state = this.invalid()
      ? ' border-red-600 focus:border-red-600 focus:ring-3 focus:ring-red-600/10'
      : ' border-gray-300 focus:border-blue-600 focus:ring-3 focus:ring-blue-600/10';
    return `${base}${state}`;
  });

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    this.controlValue.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected onInput(event: Event): void {
    const nextValue = (event.target as HTMLInputElement).value;
    this.controlValue.set(nextValue);
    this.onChange(nextValue);
    this.valueChanged.emit(nextValue);
  }

  protected onBlur(): void {
    this.onTouched();
    this.blurred.emit();
  }
}
```

```html
<input
  [id]="id() || null"
  [type]="type()"
  [placeholder]="placeholder()"
  [value]="displayValue()"
  [disabled]="disabled()"
  [attr.autocomplete]="autocomplete()"
  [attr.aria-invalid]="invalid()"
  [attr.aria-describedby]="describedBy() || null"
  [class]="inputClasses()"
  (input)="onInput($event)"
  (blur)="onBlur()"
/>
```

```scss
:host {
  display: block;
  width: 100%;
}
```

```typescript
import type { Meta, StoryObj } from '@storybook/angular';
import { InputComponent } from './input.component';

const meta: Meta<InputComponent> = {
  title: 'Atoms/Input',
  component: InputComponent,
  args: {
    id: 'email',
    type: 'email',
    placeholder: 'name@example.com',
    autocomplete: 'email',
    invalid: false,
  },
};

export default meta;
type Story = StoryObj<InputComponent>;

export const Email: Story = {};

export const Invalid: Story = {
  args: {
    invalid: true,
    placeholder: 'Invalid state',
  },
};
```

- [ ] **Step 4: Export it**

Add this line to `libs/ui/design-system/src/index.ts`:

```typescript
export * from './lib/atoms/input/input.component';
```

- [ ] **Step 5: Run the test**

Run: `npx nx test design-system --testFile=input.component.spec.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/ui/design-system/src/lib/atoms/input libs/ui/design-system/src/index.ts
git commit -m "feat(ui): add input atom"
```

---

## Task 3: Add Button Atom

**Files:**
- Create: `libs/ui/design-system/src/lib/atoms/button/button.component.ts`
- Create: `libs/ui/design-system/src/lib/atoms/button/button.component.html`
- Create: `libs/ui/design-system/src/lib/atoms/button/button.component.scss`
- Create: `libs/ui/design-system/src/lib/atoms/button/button.component.spec.ts`
- Create: `libs/ui/design-system/src/lib/atoms/button/button.stories.ts`
- Modify: `libs/ui/design-system/src/index.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ButtonComponent } from './button.component';

describe('ButtonComponent', () => {
  let fixture: ComponentFixture<ButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ButtonComponent);
  });

  it('renders a submit button with projected content', () => {
    fixture.componentRef.setInput('type', 'submit');
    fixture.componentRef.setInput('variant', 'primary');
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.type).toBe('submit');
    expect(button.className).toContain('tai-button');
    expect(button.className).toContain('bg-blue-600');
  });

  it('does not emit pressed when disabled', () => {
    const spy = vi.fn();
    fixture.componentInstance.pressed.subscribe(spy);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    button.click();

    expect(spy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx nx test design-system --testFile=button.component.spec.ts`

Expected: FAIL because `ButtonComponent` does not exist.

- [ ] **Step 3: Add the component**

```typescript
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type TaiButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type TaiButtonType = 'button' | 'submit' | 'reset';

@Component({
  selector: 'tai-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './button.component.html',
  styleUrl: './button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ButtonComponent {
  readonly type = input<TaiButtonType>('button');
  readonly variant = input<TaiButtonVariant>('primary');
  readonly disabled = input<boolean>(false);
  readonly ariaLabel = input<string>('');
  readonly testId = input<string>('');
  readonly pressed = output<MouseEvent>();

  protected readonly buttonClasses = computed(() => {
    const base =
      'tai-button inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold outline-none transition-colors duration-200 focus:ring-3 disabled:cursor-not-allowed disabled:opacity-60';
    const variants: Record<TaiButtonVariant, string> = {
      primary: ' bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-600/20',
      secondary: ' border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 focus:ring-gray-400/20',
      ghost: ' bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-400/20',
      danger: ' bg-red-600 text-white hover:bg-red-700 focus:ring-red-600/20',
    };
    return `${base}${variants[this.variant()]}`;
  });

  protected onClick(event: MouseEvent): void {
    if (this.disabled()) {
      event.preventDefault();
      return;
    }
    this.pressed.emit(event);
  }
}
```

```html
<button
  [type]="type()"
  [disabled]="disabled()"
  [attr.aria-label]="ariaLabel() || null"
  [attr.data-testid]="testId() || null"
  [class]="buttonClasses()"
  (click)="onClick($event)"
>
  <ng-content></ng-content>
</button>
```

```scss
:host {
  display: inline-flex;
}
```

```typescript
import type { Meta, StoryObj } from '@storybook/angular';
import { ButtonComponent } from './button.component';

const meta: Meta<ButtonComponent> = {
  title: 'Atoms/Button',
  component: ButtonComponent,
  args: {
    type: 'button',
    variant: 'primary',
    disabled: false,
  },
  render: (args) => ({
    props: args,
    template: `<tai-button [type]="type" [variant]="variant" [disabled]="disabled">Sign In</tai-button>`,
  }),
};

export default meta;
type Story = StoryObj<ButtonComponent>;

export const Primary: Story = {};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
  },
};
```

- [ ] **Step 4: Export it**

Add this line to `libs/ui/design-system/src/index.ts`:

```typescript
export * from './lib/atoms/button/button.component';
```

- [ ] **Step 5: Run the test**

Run: `npx nx test design-system --testFile=button.component.spec.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/ui/design-system/src/lib/atoms/button libs/ui/design-system/src/index.ts
git commit -m "feat(ui): add button atom"
```

---

## Task 4: Add Checkbox Atom

**Files:**
- Create: `libs/ui/design-system/src/lib/atoms/checkbox/checkbox.component.ts`
- Create: `libs/ui/design-system/src/lib/atoms/checkbox/checkbox.component.html`
- Create: `libs/ui/design-system/src/lib/atoms/checkbox/checkbox.component.scss`
- Create: `libs/ui/design-system/src/lib/atoms/checkbox/checkbox.component.spec.ts`
- Create: `libs/ui/design-system/src/lib/atoms/checkbox/checkbox.stories.ts`
- Modify: `libs/ui/design-system/src/index.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { describe, expect, it, beforeEach } from 'vitest';
import { CheckboxComponent } from './checkbox.component';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, CheckboxComponent],
  template: `<tai-checkbox id="select-all" ariaLabel="Select all rows" [formControl]="control" />`,
})
class HostComponent {
  readonly control = new FormControl(false, { nonNullable: true });
}

describe('CheckboxComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('renders accessible checkbox attributes', () => {
    const checkbox = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(checkbox.type).toBe('checkbox');
    expect(checkbox.id).toBe('select-all');
    expect(checkbox.getAttribute('aria-label')).toBe('Select all rows');
  });

  it('writes checked state through ControlValueAccessor', () => {
    const checkbox = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    checkbox.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.control.value).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx nx test design-system --testFile=checkbox.component.spec.ts`

Expected: FAIL because `CheckboxComponent` does not exist.

- [ ] **Step 3: Add the component**

```typescript
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'tai-checkbox',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './checkbox.component.html',
  styleUrl: './checkbox.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CheckboxComponent),
      multi: true,
    },
  ],
})
export class CheckboxComponent implements ControlValueAccessor {
  readonly id = input<string>('');
  readonly ariaLabel = input<string>('');
  readonly invalid = input<boolean>(false);

  protected readonly checked = signal<boolean>(false);
  protected readonly disabled = signal<boolean>(false);

  protected readonly checkboxClasses = computed(() => {
    const base =
      'tai-checkbox h-4 w-4 rounded border bg-white text-blue-600 outline-none transition-colors duration-200 focus:ring-3 disabled:cursor-not-allowed disabled:opacity-60';
    const state = this.invalid()
      ? ' border-red-600 focus:ring-red-600/20'
      : ' border-gray-300 focus:ring-blue-600/20';
    return `${base}${state}`;
  });

  private onChange: (value: boolean) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: boolean | null): void {
    this.checked.set(Boolean(value));
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected onInput(event: Event): void {
    const nextChecked = (event.target as HTMLInputElement).checked;
    this.checked.set(nextChecked);
    this.onChange(nextChecked);
  }

  protected onBlur(): void {
    this.onTouched();
  }
}
```

```html
<input
  [id]="id() || null"
  type="checkbox"
  [checked]="checked()"
  [disabled]="disabled()"
  [attr.aria-label]="ariaLabel() || null"
  [attr.aria-invalid]="invalid()"
  [class]="checkboxClasses()"
  (change)="onInput($event)"
  (blur)="onBlur()"
/>
```

```scss
:host {
  display: inline-flex;
}
```

```typescript
import type { Meta, StoryObj } from '@storybook/angular';
import { CheckboxComponent } from './checkbox.component';

const meta: Meta<CheckboxComponent> = {
  title: 'Atoms/Checkbox',
  component: CheckboxComponent,
  args: {
    id: 'select-row',
    ariaLabel: 'Select row',
    invalid: false,
  },
};

export default meta;
type Story = StoryObj<CheckboxComponent>;

export const Default: Story = {};
```

- [ ] **Step 4: Export it**

Add this line to `libs/ui/design-system/src/index.ts`:

```typescript
export * from './lib/atoms/checkbox/checkbox.component';
```

- [ ] **Step 5: Run the test**

Run: `npx nx test design-system --testFile=checkbox.component.spec.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/ui/design-system/src/lib/atoms/checkbox libs/ui/design-system/src/index.ts
git commit -m "feat(ui): add checkbox atom"
```

---

## Task 5: Add Icon Atom

**Files:**
- Create: `libs/ui/design-system/src/lib/atoms/icon/icon.component.ts`
- Create: `libs/ui/design-system/src/lib/atoms/icon/icon.component.html`
- Create: `libs/ui/design-system/src/lib/atoms/icon/icon.component.scss`
- Create: `libs/ui/design-system/src/lib/atoms/icon/icon.component.spec.ts`
- Create: `libs/ui/design-system/src/lib/atoms/icon/icon.stories.ts`
- Modify: `libs/ui/design-system/src/index.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { IconComponent } from './icon.component';

describe('IconComponent', () => {
  let fixture: ComponentFixture<IconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IconComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(IconComponent);
  });

  it('renders the menu icon with no innerHTML sink', () => {
    fixture.componentRef.setInput('name', 'more-vertical');
    fixture.detectChanges();

    const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.querySelectorAll('circle').length).toBe(3);
    expect(fixture.nativeElement.querySelector('[innerHTML]')).toBeNull();
  });

  it('supports accessible labeling when decorative is false', () => {
    fixture.componentRef.setInput('name', 'chevron-up-down');
    fixture.componentRef.setInput('ariaLabel', 'Sort');
    fixture.componentRef.setInput('decorative', false);
    fixture.detectChanges();

    const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
    expect(svg.getAttribute('aria-label')).toBe('Sort');
    expect(svg.getAttribute('role')).toBe('img');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx nx test design-system --testFile=icon.component.spec.ts`

Expected: FAIL because `IconComponent` does not exist.

- [ ] **Step 3: Add the component**

```typescript
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type TaiIconName =
  | 'chevron-up'
  | 'chevron-down'
  | 'chevron-up-down'
  | 'more-vertical'
  | 'search'
  | 'empty-state';

@Component({
  selector: 'tai-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './icon.component.html',
  styleUrl: './icon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconComponent {
  readonly name = input.required<TaiIconName>();
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly decorative = input<boolean>(true);
  readonly ariaLabel = input<string>('');

  protected readonly iconClasses = computed(() => {
    const sizes = {
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-16 w-16',
    };
    return `tai-icon ${sizes[this.size()]}`;
  });
}
```

```html
<svg
  [class]="iconClasses()"
  fill="none"
  stroke="currentColor"
  viewBox="0 0 24 24"
  [attr.aria-hidden]="decorative() ? 'true' : null"
  [attr.aria-label]="decorative() ? null : ariaLabel()"
  [attr.role]="decorative() ? null : 'img'"
>
  @switch (name()) {
    @case ('chevron-up') {
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
    }
    @case ('chevron-down') {
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
    }
    @case ('chevron-up-down') {
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
    }
    @case ('more-vertical') {
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    }
    @case ('search') {
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" />
    }
    @case ('empty-state') {
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    }
  }
</svg>
```

```scss
:host {
  display: inline-flex;
  line-height: 0;
}
```

```typescript
import type { Meta, StoryObj } from '@storybook/angular';
import { IconComponent } from './icon.component';

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

export const MoreVertical: Story = {};

export const Sort: Story = {
  args: {
    name: 'chevron-up-down',
    decorative: false,
    ariaLabel: 'Sort',
  },
};
```

- [ ] **Step 4: Export it**

Add this line to `libs/ui/design-system/src/index.ts`:

```typescript
export * from './lib/atoms/icon/icon.component';
```

- [ ] **Step 5: Run the test**

Run: `npx nx test design-system --testFile=icon.component.spec.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/ui/design-system/src/lib/atoms/icon libs/ui/design-system/src/index.ts
git commit -m "feat(ui): add icon atom"
```

---

## Task 6: Move Secure Input Into Atoms and Compose Input + Label

**Files:**
- Move: `libs/ui/design-system/src/lib/design-system/secure-input/*` to `libs/ui/design-system/src/lib/atoms/secure-input/*`
- Modify: `libs/ui/design-system/src/lib/atoms/secure-input/secure-input.ts`
- Modify: `libs/ui/design-system/src/lib/atoms/secure-input/secure-input.html`
- Modify: `libs/ui/design-system/src/lib/atoms/secure-input/secure-input.spec.ts`
- Modify: `libs/ui/design-system/src/lib/atoms/secure-input/secure-input.stories.ts`
- Modify: `libs/ui/design-system/src/index.ts`
- Modify references in `registration-form`, `otp-verification-form`, and `login-form` after their own moves.

- [ ] **Step 1: Move files with Git**

Run:

```bash
mkdir -p libs/ui/design-system/src/lib/atoms
git mv libs/ui/design-system/src/lib/design-system/secure-input libs/ui/design-system/src/lib/atoms/secure-input
```

Expected: files move without content changes.

- [ ] **Step 2: Update imports inside secure-input**

In `libs/ui/design-system/src/lib/atoms/secure-input/secure-input.ts`, add atom imports:

```typescript
import { InputComponent } from '../input/input.component';
import { LabelComponent } from '../label/label.component';
```

Change the component imports array:

```typescript
imports: [CommonModule, ReactiveFormsModule, InputComponent, LabelComponent],
```

- [ ] **Step 3: Replace the template with atom composition**

Use this exact `secure-input.html`:

```html
<div class="secure-input-container flex flex-col mb-6 w-full">
  <tai-label
    [forId]="id()"
    [text]="label()"
  />

  <tai-input
    [id]="id()"
    [type]="type()"
    [placeholder]="placeholder()"
    [autocomplete]="autocompleteValue"
    [invalid]="!!(errorMessage() && isTouched())"
    [value]="value()"
    (valueChanged)="onInputValueChanged($event)"
    (blurred)="onBlur()"
  />

  @if (errorMessage() && isTouched()) {
    <div
      class="error-message mt-2 text-xs text-red-600 font-medium"
      [textContent]="errorMessage()"
      aria-live="polite"
      role="alert"
    ></div>
  }
</div>
```

- [ ] **Step 4: Adjust secure-input TypeScript for the atom wrapper**

In `secure-input.ts`, add this method and remove `trustedErrorMessage` if it is no longer used by the template:

```typescript
protected onInputValueChanged(nextValue: string): void {
  this.value.set(nextValue);
  this.onChange(nextValue);
}
```

Keep `TrustedTypesService` exported for backward compatibility in Phase 1, but do not bind secure-input errors with `[innerHTML]`.

- [ ] **Step 5: Update the secure-input test import path**

In `secure-input.spec.ts`, keep the relative import as:

```typescript
import { SecureInputComponent } from './secure-input';
```

Add this test:

```typescript
it('renders error messages with textContent instead of innerHTML', () => {
  fixture.componentRef.setInput('errorMessage', '<img src=x onerror=alert(1)>Invalid');
  component.writeValue('bad');
  const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
  input.dispatchEvent(new Event('blur'));
  fixture.detectChanges();

  const error = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
  expect(error.textContent).toContain('<img src=x onerror=alert(1)>Invalid');
  expect(error.querySelector('img')).toBeNull();
});
```

- [ ] **Step 6: Update public exports**

Replace these existing lines in `libs/ui/design-system/src/index.ts`:

```typescript
export * from './lib/design-system/secure-input/secure-input';
export * from './lib/design-system/secure-input/trusted-types.service';
```

with:

```typescript
export * from './lib/atoms/secure-input/secure-input';
export * from './lib/atoms/secure-input/trusted-types.service';
```

- [ ] **Step 7: Run secure-input tests**

Run: `npx nx test design-system --testFile=secure-input.spec.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add libs/ui/design-system/src/lib/atoms/secure-input libs/ui/design-system/src/index.ts
git add -u libs/ui/design-system/src/lib/design-system/secure-input
git commit -m "refactor(ui): move secure input into atoms"
```

---

## Task 7: Add Form Field Molecule

**Files:**
- Create: `libs/ui/design-system/src/lib/molecules/form-field/form-field.component.ts`
- Create: `libs/ui/design-system/src/lib/molecules/form-field/form-field.component.html`
- Create: `libs/ui/design-system/src/lib/molecules/form-field/form-field.component.scss`
- Create: `libs/ui/design-system/src/lib/molecules/form-field/form-field.component.spec.ts`
- Create: `libs/ui/design-system/src/lib/molecules/form-field/form-field.stories.ts`
- Modify: `libs/ui/design-system/src/index.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { FormFieldComponent } from './form-field.component';

describe('FormFieldComponent', () => {
  let fixture: ComponentFixture<FormFieldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormFieldComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FormFieldComponent);
  });

  it('renders label, hint, and text-only error', () => {
    fixture.componentRef.setInput('controlId', 'email');
    fixture.componentRef.setInput('label', 'Corporate Email');
    fixture.componentRef.setInput('hint', 'Use your company email.');
    fixture.componentRef.setInput('error', '<script>alert(1)</script>Invalid email');
    fixture.componentRef.setInput('required', true);
    fixture.detectChanges();

    const label = fixture.nativeElement.querySelector('label') as HTMLLabelElement;
    const hint = fixture.nativeElement.querySelector('[data-testid="form-field-hint"]') as HTMLElement;
    const error = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;

    expect(label.getAttribute('for')).toBe('email');
    expect(hint.textContent).toContain('Use your company email.');
    expect(error.textContent).toContain('<script>alert(1)</script>Invalid email');
    expect(error.querySelector('script')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx nx test design-system --testFile=form-field.component.spec.ts`

Expected: FAIL because `FormFieldComponent` does not exist.

- [ ] **Step 3: Add the component**

```typescript
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LabelComponent } from '../../atoms/label/label.component';

@Component({
  selector: 'tai-form-field',
  standalone: true,
  imports: [CommonModule, LabelComponent],
  templateUrl: './form-field.component.html',
  styleUrl: './form-field.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormFieldComponent {
  readonly controlId = input.required<string>();
  readonly label = input.required<string>();
  readonly hint = input<string>('');
  readonly error = input<string>('');
  readonly required = input<boolean>(false);

  readonly hintId = computed(() => `${this.controlId()}-hint`);
  readonly errorId = computed(() => `${this.controlId()}-error`);
  readonly describedBy = computed(() => {
    const ids: string[] = [];
    if (this.hint()) {
      ids.push(this.hintId());
    }
    if (this.error()) {
      ids.push(this.errorId());
    }
    return ids.join(' ');
  });
}
```

```html
<div class="tai-form-field flex w-full flex-col gap-2">
  <tai-label
    [forId]="controlId()"
    [text]="label()"
    [required]="required()"
  />

  <ng-content></ng-content>

  @if (hint()) {
    <p
      [id]="hintId()"
      class="text-xs text-gray-500"
      data-testid="form-field-hint"
      [textContent]="hint()"
    ></p>
  }

  @if (error()) {
    <p
      [id]="errorId()"
      class="text-xs font-medium text-red-600"
      aria-live="polite"
      role="alert"
      [textContent]="error()"
    ></p>
  }
</div>
```

```scss
:host {
  display: block;
  width: 100%;
}
```

```typescript
import type { Meta, StoryObj } from '@storybook/angular';
import { FormFieldComponent } from './form-field.component';
import { InputComponent } from '../../atoms/input/input.component';

const meta: Meta<FormFieldComponent> = {
  title: 'Molecules/Form Field',
  component: FormFieldComponent,
  args: {
    controlId: 'email',
    label: 'Corporate Email',
    hint: 'Use your company email.',
    error: '',
    required: true,
  },
  render: (args) => ({
    props: args,
    imports: [FormFieldComponent, InputComponent],
    template: `
      <tai-form-field
        [controlId]="controlId"
        [label]="label"
        [hint]="hint"
        [error]="error"
        [required]="required"
      >
        <tai-input [id]="controlId" type="email" autocomplete="email" />
      </tai-form-field>
    `,
  }),
};

export default meta;
type Story = StoryObj<FormFieldComponent>;

export const Default: Story = {};

export const WithError: Story = {
  args: {
    error: 'A valid corporate email is required.',
  },
};
```

- [ ] **Step 4: Export it**

Add this line to `libs/ui/design-system/src/index.ts`:

```typescript
export * from './lib/molecules/form-field/form-field.component';
```

- [ ] **Step 5: Run the test**

Run: `npx nx test design-system --testFile=form-field.component.spec.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/ui/design-system/src/lib/molecules/form-field libs/ui/design-system/src/index.ts
git commit -m "feat(ui): add form field molecule"
```

---

## Task 8: Reorganize Existing Components Into Tiers

**Files:**
- Move existing molecule directories:
  - `libs/ui/design-system/src/lib/design-system/confirmation-dialog` to `libs/ui/design-system/src/lib/molecules/confirmation-dialog`
  - `libs/ui/design-system/src/lib/design-system/crypto-unavailable` to `libs/ui/design-system/src/lib/molecules/crypto-unavailable`
  - `libs/ui/design-system/src/lib/design-system/pending-approvals-tile` to `libs/ui/design-system/src/lib/molecules/pending-approvals-tile`
  - `libs/ui/design-system/src/lib/design-system/security-alert` to `libs/ui/design-system/src/lib/molecules/security-alert`
  - `libs/ui/design-system/src/lib/design-system/toast` to `libs/ui/design-system/src/lib/molecules/toast`
- Move `notification-toggle` files from `libs/ui/design-system/src/lib/design-system/notification-panel/` to `libs/ui/design-system/src/lib/molecules/notification-toggle/`
- Move existing organism directories:
  - `libs/ui/design-system/src/lib/design-system/data-table` to `libs/ui/design-system/src/lib/organisms/data-table`
  - `libs/ui/design-system/src/lib/design-system/login-form` to `libs/ui/design-system/src/lib/organisms/login-form`
  - `libs/ui/design-system/src/lib/design-system/notification-panel` to `libs/ui/design-system/src/lib/organisms/notification-panel`
  - `libs/ui/design-system/src/lib/design-system/otp-verification-form` to `libs/ui/design-system/src/lib/organisms/otp-verification-form`
  - `libs/ui/design-system/src/lib/design-system/registration-form` to `libs/ui/design-system/src/lib/organisms/registration-form`
  - `libs/ui/design-system/src/lib/design-system/transfer-list` to `libs/ui/design-system/src/lib/organisms/transfer-list`
  - `libs/ui/design-system/src/lib/app-shell` to `libs/ui/design-system/src/lib/organisms/app-shell`
  - `libs/ui/design-system/src/lib/sidebar` to `libs/ui/design-system/src/lib/organisms/sidebar`
  - `libs/ui/design-system/src/lib/user-profile` to `libs/ui/design-system/src/lib/organisms/user-profile`
  - `libs/ui/design-system/src/lib/wizard` to `libs/ui/design-system/src/lib/organisms/wizard`
- Delete or leave behind only `hello-world` as legacy demo if consumers still import it.
- Modify: `libs/ui/design-system/src/index.ts`

- [ ] **Step 1: Move molecule files with Git**

Run:

```bash
mkdir -p libs/ui/design-system/src/lib/molecules libs/ui/design-system/src/lib/organisms
git mv libs/ui/design-system/src/lib/design-system/confirmation-dialog libs/ui/design-system/src/lib/molecules/confirmation-dialog
git mv libs/ui/design-system/src/lib/design-system/crypto-unavailable libs/ui/design-system/src/lib/molecules/crypto-unavailable
git mv libs/ui/design-system/src/lib/design-system/pending-approvals-tile libs/ui/design-system/src/lib/molecules/pending-approvals-tile
git mv libs/ui/design-system/src/lib/design-system/security-alert libs/ui/design-system/src/lib/molecules/security-alert
git mv libs/ui/design-system/src/lib/design-system/toast libs/ui/design-system/src/lib/molecules/toast
mkdir -p libs/ui/design-system/src/lib/molecules/notification-toggle
git mv libs/ui/design-system/src/lib/design-system/notification-panel/notification-toggle.component.ts libs/ui/design-system/src/lib/molecules/notification-toggle/notification-toggle.component.ts
git mv libs/ui/design-system/src/lib/design-system/notification-panel/notification-toggle.component.html libs/ui/design-system/src/lib/molecules/notification-toggle/notification-toggle.component.html
git mv libs/ui/design-system/src/lib/design-system/notification-panel/notification-toggle.component.scss libs/ui/design-system/src/lib/molecules/notification-toggle/notification-toggle.component.scss
git mv libs/ui/design-system/src/lib/design-system/notification-panel/notification-toggle.spec.ts libs/ui/design-system/src/lib/molecules/notification-toggle/notification-toggle.spec.ts
git mv libs/ui/design-system/src/lib/design-system/notification-panel/notification-toggle.stories.ts libs/ui/design-system/src/lib/molecules/notification-toggle/notification-toggle.stories.ts
```

- [ ] **Step 2: Move organism files with Git**

Run:

```bash
git mv libs/ui/design-system/src/lib/design-system/data-table libs/ui/design-system/src/lib/organisms/data-table
git mv libs/ui/design-system/src/lib/design-system/login-form libs/ui/design-system/src/lib/organisms/login-form
git mv libs/ui/design-system/src/lib/design-system/notification-panel libs/ui/design-system/src/lib/organisms/notification-panel
git mv libs/ui/design-system/src/lib/design-system/otp-verification-form libs/ui/design-system/src/lib/organisms/otp-verification-form
git mv libs/ui/design-system/src/lib/design-system/registration-form libs/ui/design-system/src/lib/organisms/registration-form
git mv libs/ui/design-system/src/lib/design-system/transfer-list libs/ui/design-system/src/lib/organisms/transfer-list
git mv libs/ui/design-system/src/lib/app-shell libs/ui/design-system/src/lib/organisms/app-shell
git mv libs/ui/design-system/src/lib/sidebar libs/ui/design-system/src/lib/organisms/sidebar
git mv libs/ui/design-system/src/lib/user-profile libs/ui/design-system/src/lib/organisms/user-profile
git mv libs/ui/design-system/src/lib/wizard libs/ui/design-system/src/lib/organisms/wizard
```

- [ ] **Step 3: Update moved relative imports**

Use `rg -n "secure-input|notification-panel.service|sidebar|user-profile" libs/ui/design-system/src/lib` to find moved imports.

Make these known replacements:

```typescript
// In organisms/login-form/login-form.ts
import { SecureInputComponent } from '../../atoms/secure-input/secure-input';

// In organisms/registration-form/registration-form.ts
import { SecureInputComponent } from '../../atoms/secure-input/secure-input';

// In organisms/otp-verification-form/otp-verification-form.ts
import { SecureInputComponent } from '../../atoms/secure-input/secure-input';

// In organisms/app-shell/app-shell.component.ts
import { SidebarComponent, MenuItem } from '../sidebar/sidebar.component';
import { UserProfileComponent, UserProfile } from '../user-profile/user-profile.component';

// In molecules/notification-toggle/notification-toggle.component.ts
import { NotificationPanelService } from '../../organisms/notification-panel/notification-panel.service';
```

- [ ] **Step 4: Replace `index.ts` with tier-aware exports**

Use this exact `libs/ui/design-system/src/index.ts` content:

```typescript
export * from './lib/design-system/hello-world';

export * from './lib/atoms/button/button.component';
export * from './lib/atoms/checkbox/checkbox.component';
export * from './lib/atoms/icon/icon.component';
export * from './lib/atoms/input/input.component';
export * from './lib/atoms/label/label.component';
export * from './lib/atoms/secure-input/secure-input';
export * from './lib/atoms/secure-input/trusted-types.service';

export * from './lib/molecules/confirmation-dialog/confirmation-dialog';
export * from './lib/molecules/crypto-unavailable/crypto-unavailable';
export * from './lib/molecules/form-field/form-field.component';
export * from './lib/molecules/notification-toggle/notification-toggle.component';
export * from './lib/molecules/pending-approvals-tile/pending-approvals-tile';
export * from './lib/molecules/security-alert/security-alert';
export * from './lib/molecules/toast/index';

export * from './lib/organisms/app-shell/app-shell.component';
export * from './lib/organisms/data-table/data-table';
export * from './lib/organisms/login-form/login-form';
export * from './lib/organisms/notification-panel/notification-panel.component';
export * from './lib/organisms/notification-panel/notification-panel.service';
export * from './lib/organisms/notification-panel/notification-panel.types';
export * from './lib/organisms/otp-verification-form/otp-verification-form';
export * from './lib/organisms/registration-form/registration-form';
export * from './lib/organisms/sidebar/sidebar.component';
export * from './lib/organisms/transfer-list/transfer-list';
export * from './lib/organisms/user-profile/user-profile.component';
export * from './lib/organisms/wizard/wizard.component';

export * from './lib/directives/has-privilege.directive';
```

- [ ] **Step 5: Run import and build verification**

Run:

```bash
npx nx test design-system
npx nx lint design-system
npx nx build design-system
npx nx test portal-web
npx nx lint portal-web
npx nx test identity-ui
npx nx lint identity-ui
npx nx test borrower-portal
npx nx lint borrower-portal
npx nx build portal-web
npx nx build identity-ui
npx nx build borrower-portal
```

Expected: PASS. This is required immediately after the reorganization because public exports are consumed by `portal-web`, `identity-ui`, and `borrower-portal`. Any lint, import, or build failures should point to remaining stale relative paths, broken barrel exports, or invalid template bindings.

- [ ] **Step 6: Commit**

```bash
git add libs/ui/design-system/src
git commit -m "refactor(ui): organize design system by atomic tier"
```

---

## Task 9: Refactor Login Form To Compose Form Field, Secure Input, and Button

**Files:**
- Modify: `libs/ui/design-system/src/lib/organisms/login-form/login-form.ts`
- Modify: `libs/ui/design-system/src/lib/organisms/login-form/login-form.html`
- Modify: `libs/ui/design-system/src/lib/organisms/login-form/login-form.spec.ts`
- Modify: `libs/ui/design-system/src/lib/organisms/login-form/login-form.stories.ts`

- [ ] **Step 1: Update the failing test**

In `login-form.spec.ts`, update imports:

```typescript
import { LoginFormComponent } from './login-form';
import { SecureInputComponent } from '../../atoms/secure-input/secure-input';
import { ButtonComponent } from '../../atoms/button/button.component';
import { FormFieldComponent } from '../../molecules/form-field/form-field.component';
```

Add this test:

```typescript
it('visibly composes molecule and atom selectors', () => {
  const formFields = fixture.nativeElement.querySelectorAll('tai-form-field');
  const secureInputs = fixture.nativeElement.querySelectorAll('tai-secure-input');
  const buttons = fixture.nativeElement.querySelectorAll('tai-button');

  expect(formFields.length).toBe(2);
  expect(secureInputs.length).toBe(2);
  expect(buttons.length).toBe(1);
});
```

- [ ] **Step 2: Run the test to verify it fails before refactor**

Run: `npx nx test design-system --testFile=login-form.spec.ts`

Expected: FAIL because the template does not yet use `tai-form-field` or `tai-button`.

- [ ] **Step 3: Update component imports**

Use this imports block in `login-form.ts`:

```typescript
import { Component, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormGroup,
  FormControl,
  Validators,
} from '@angular/forms';
import { ButtonComponent } from '../../atoms/button/button.component';
import { SecureInputComponent } from '../../atoms/secure-input/secure-input';
import { FormFieldComponent } from '../../molecules/form-field/form-field.component';
```

Update the component imports array:

```typescript
imports: [
  CommonModule,
  ReactiveFormsModule,
  ButtonComponent,
  SecureInputComponent,
  FormFieldComponent,
],
```

- [ ] **Step 4: Add helper methods**

Add these methods to `LoginFormComponent`:

```typescript
public getEmailError(): string {
  const control = this.loginForm.controls.email;
  if (!control.touched || control.valid) {
    return '';
  }
  return 'A valid corporate email is required.';
}

public getPasswordError(): string {
  const control = this.loginForm.controls.password;
  if (!control.touched || control.valid) {
    return '';
  }
  return 'Password must be at least 8 characters.';
}
```

- [ ] **Step 5: Replace the template**

Use this exact `login-form.html`:

```html
<form
  [formGroup]="loginForm"
  (ngSubmit)="onSubmit()"
  class="login-form-container flex w-full flex-col gap-6 p-4"
  role="form"
>
  <tai-form-field
    controlId="login-email"
    label="Corporate Email"
    hint="Use your company email address."
    [error]="getEmailError()"
    [required]="true"
  >
    <tai-secure-input
      id="login-email"
      type="email"
      placeholder="e.g. jdoe@tai.com"
      formControlName="email"
      [errorMessage]="getEmailError()"
    />
  </tai-form-field>

  <tai-form-field
    controlId="login-password"
    label="Password"
    [error]="getPasswordError()"
    [required]="true"
  >
    <tai-secure-input
      id="login-password"
      type="password"
      placeholder="Enter your secure password"
      formControlName="password"
      [errorMessage]="getPasswordError()"
    />
  </tai-form-field>

  <tai-button
    type="submit"
    variant="primary"
    testId="login-submit"
    [disabled]="loginForm.invalid"
  >
    Sign In to Portal
  </tai-button>
</form>
```

- [ ] **Step 6: Run the test**

Run: `npx nx test design-system --testFile=login-form.spec.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add libs/ui/design-system/src/lib/organisms/login-form
git commit -m "refactor(ui): compose login form from tiered components"
```

---

## Task 10: Refactor Data Table To Compose Button and Icon Atoms

**Files:**
- Modify: `libs/ui/design-system/src/lib/organisms/data-table/data-table.ts`
- Modify: `libs/ui/design-system/src/lib/organisms/data-table/data-table.html`
- Modify: `libs/ui/design-system/src/lib/organisms/data-table/data-table.spec.ts`
- Modify: `libs/ui/design-system/src/lib/organisms/data-table/data-table.stories.ts`

- [ ] **Step 1: Update the failing test**

In `data-table.spec.ts`, update imports:

```typescript
import { ButtonComponent } from '../../atoms/button/button.component';
import { IconComponent } from '../../atoms/icon/icon.component';
```

Add this test:

```typescript
it('visibly composes button and icon atoms', () => {
  const buttons = fixture.nativeElement.querySelectorAll('tai-button');
  const icons = fixture.nativeElement.querySelectorAll('tai-icon');

  expect(buttons.length).toBeGreaterThanOrEqual(3);
  expect(icons.length).toBeGreaterThanOrEqual(1);
});
```

- [ ] **Step 2: Run the test to verify it fails before refactor**

Run: `npx nx test design-system --testFile=data-table.spec.ts`

Expected: FAIL because `data-table.html` still uses native button and inline SVG for all controls.

- [ ] **Step 3: Update component imports**

Add imports to `data-table.ts`:

```typescript
import { ButtonComponent } from '../../atoms/button/button.component';
import { IconComponent } from '../../atoms/icon/icon.component';
```

Update the component imports array:

```typescript
imports: [
  CommonModule,
  CdkTableModule,
  CdkMenuModule,
  ButtonComponent,
  IconComponent,
],
```

- [ ] **Step 4: Replace sortable header button block**

In `data-table.html`, replace the native sort `<button>` with:

```html
<tai-button
  type="button"
  variant="ghost"
  [testId]="'sort-button-' + column.id"
  [ariaLabel]="'Sort by ' + column.header"
  (pressed)="toggleSort(column.id)"
>
  <span [textContent]="column.header"></span>
  @if (sortState()?.columnId === column.id) {
    <tai-icon
      [name]="sortState()?.direction === 'asc' ? 'chevron-up' : 'chevron-down'"
      size="sm"
    />
  } @else {
    <tai-icon name="chevron-up-down" size="sm" />
  }
</tai-button>
```

- [ ] **Step 5: Replace action menu trigger SVG**

In `data-table.html`, replace the native action trigger button with:

```html
<tai-button
  type="button"
  variant="ghost"
  ariaLabel="Actions"
  [testId]="'action-menu-trigger-' + (row.id || row.Id)"
  [cdkMenuTriggerFor]="menu"
>
  <tai-icon name="more-vertical" />
</tai-button>
```

- [ ] **Step 6: Replace action menu item native button**

Inside the `cdkMenu` loop, replace the native action button with:

```html
<tai-button
  type="button"
  variant="ghost"
  [testId]="'action-' + action.id"
  (pressed)="onAction(action.id, row)"
  cdkMenuItem
>
  <span [textContent]="action.label"></span>
</tai-button>
```

Do not bind `[class]="action.class"` in Phase 1. Keep `TableActionDef.class` in the TypeScript interface for backward compatibility, but ignore it in the template so caller-provided classes cannot bypass component styling.

- [ ] **Step 7: Replace pagination buttons**

Replace the Previous button with:

```html
<tai-button
  type="button"
  variant="secondary"
  testId="pagination-prev"
  [disabled]="pageIndex() === 1"
  (pressed)="onPageChange(pageIndex() - 1)"
>
  Previous
</tai-button>
```

Replace the Next button with:

```html
<tai-button
  type="button"
  variant="secondary"
  testId="pagination-next"
  [disabled]="pageIndex() === totalPages()"
  (pressed)="onPageChange(pageIndex() + 1)"
>
  Next
</tai-button>
```

- [ ] **Step 8: Replace empty-state inline SVG**

Replace the empty state SVG block with:

```html
<div class="mb-4 text-gray-400">
  <tai-icon name="empty-state" size="lg" />
</div>
```

- [ ] **Step 9: Run the test**

Run: `npx nx test design-system --testFile=data-table.spec.ts`

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add libs/ui/design-system/src/lib/organisms/data-table
git commit -m "refactor(ui): compose data table from atoms"
```

---

## Task 11: Add Phase 1 Architecture and Security Notes

**Files:**
- Create: `libs/ui/design-system/PHASE1-COMPONENT-TAXONOMY.md`

- [ ] **Step 1: Create the documentation**

Use this exact content:

```markdown
# Phase 1 Component Taxonomy

## Goal

Phase 1 proves the Portal design-system taxonomy with the minimum useful component set:

- Tier 1 atoms: `tai-button`, `tai-checkbox`, `tai-icon`, `tai-input`, `tai-label`, `tai-secure-input`
- Tier 2 molecule: `tai-form-field`
- Tier 3 organisms: `tai-login-form`, `tai-data-table`

## Composition Proof

`tai-login-form` composes `tai-form-field`, `tai-secure-input`, and `tai-button`.

`tai-data-table` composes `tai-button` and `tai-icon` for sorting, action triggers, action items, empty state, and pagination.

## Tailwind and CSP

Tailwind is the styling engine, not the component library. Components use static utility classes that compile into build-time CSS served from `self`.

Phase 1 components avoid:

- `style=""`
- `[style]`
- `[innerHTML]`
- runtime-generated CSS from user input
- Angular Material overlay, ripple, or theme runtime style injection

This keeps the custom component library aligned with a strict CSP posture such as:

```text
default-src 'self';
script-src 'self';
style-src 'self';
img-src 'self' data:;
```

## Security Boundary

Atoms own low-level DOM behavior and accessibility attributes.

Molecules own reusable group structure, label/error/hint relationships, and text-only rendering for validation messages.

Organisms own feature behavior such as login submission, table sorting, pagination, row actions, and privilege-aware page composition.
```

- [ ] **Step 2: Commit**

```bash
git add libs/ui/design-system/PHASE1-COMPONENT-TAXONOMY.md
git commit -m "docs(ui): document phase 1 component taxonomy"
```

---

## Task 12: Final Cross-Project Regression Verification

**Files:**
- Verify all modified files.
- No new files required.

- [ ] **Step 1: Scan for stale paths**

Run:

```bash
rg -n "lib/design-system/(secure-input|login-form|data-table|transfer-list|registration-form|otp-verification-form|notification-panel|toast|security-alert|confirmation-dialog|pending-approvals-tile|crypto-unavailable)" libs apps
```

Expected: no matches except `hello-world` if intentionally left as a legacy demo.

- [ ] **Step 2: Scan for CSP escape hatches in new tiered components**

Run:

```bash
rg -n "innerHTML|\\[style\\]|style=|DomSanitizer|bypassSecurityTrust" libs/ui/design-system/src/lib/atoms libs/ui/design-system/src/lib/molecules libs/ui/design-system/src/lib/organisms/login-form libs/ui/design-system/src/lib/organisms/data-table
```

Expected: no matches in the new atoms, `form-field`, `login-form`, or `data-table`. `TrustedTypesService` may still exist under `atoms/secure-input` for backward compatibility, but `secure-input.html` should not use `[innerHTML]`.

- [ ] **Step 3: Run design-system unit tests**

Run:

```bash
npx nx test design-system
```

Expected: PASS.

- [ ] **Step 4: Run design-system lint**

Run:

```bash
npx nx lint design-system
```

Expected: PASS.

- [ ] **Step 5: Run unit and integration tests for every Angular consumer**

Run:

```bash
npx nx test portal-web
npx nx test identity-ui
npx nx test borrower-portal
```

Expected: PASS. These projects consume moved design-system exports:

- `portal-web`: `tai-app-shell`, `tai-sidebar`, `tai-data-table`, `tai-transfer-list`, `tai-notification-toggle`, `tai-notification-panel`, `tai-toast`, `tai-registration-form`, `tai-otp-verification-form`, `tai-pending-approvals-tile`
- `identity-ui`: `tai-login-form`
- `borrower-portal`: `tai-wizard`, `tai-security-alert`, `tai-crypto-unavailable`

- [ ] **Step 6: Run lint for every Angular consumer**

Run:

```bash
npx nx lint portal-web
npx nx lint identity-ui
npx nx lint borrower-portal
```

Expected: PASS.

- [ ] **Step 7: Build the library and every Angular consumer**

Run:

```bash
npx nx build design-system
npx nx build portal-web
npx nx build identity-ui
npx nx build borrower-portal
```

Expected: PASS. This confirms Tailwind content scanning still includes the reorganized design-system paths and that application compilation can resolve the new public exports.

- [ ] **Step 8: Run lint for every UI e2e project**

Run:

```bash
npx nx lint portal-web-e2e
npx nx lint identity-ui-e2e
npx nx lint borrower-portal-e2e
```

Expected: PASS.

- [ ] **Step 9: Run e2e tests for every UI app with moved-component coverage**

Run:

```bash
npx nx e2e portal-web-e2e
npx nx e2e identity-ui-e2e
npx nx e2e borrower-portal-e2e
```

Expected: PASS. This verifies the reorganized components still work through the browser flows, including Portal-Web pages that assert `tai-sidebar` and `tai-data-table`, Identity UI login flow using `tai-login-form`, and Borrower Portal flows using wizard/security components.

- [ ] **Step 10: Commit final verification fixes**

Only commit if verification required small fixes:

```bash
git add libs/ui/design-system apps/portal-web apps/identity-ui apps/borrower-portal apps/portal-web-e2e apps/identity-ui-e2e apps/borrower-portal-e2e
git commit -m "test(ui): verify phase 1 design system taxonomy"
```

---

## Self-Review

Spec coverage:

- Adds 5 atoms: `button`, `input`, `checkbox`, `icon`, `label`.
- Keeps and reclassifies `secure-input` as an atom.
- Adds `form-field` molecule.
- Reorganizes existing design-system components into atoms, molecules, organisms, and directives.
- Refactors `login-form` and `data-table` to visibly compose the new lower tiers.
- Documents how Tailwind supports strict CSP by producing static build-time CSS and avoiding runtime style injection.
- Requires lint, unit, integration, build, and e2e regression verification for all known consumers of the moved design-system components.

Placeholder scan:

- No implementation step uses banned placeholder wording or generic edge-case instructions.
- Code-bearing steps include concrete code or exact replacement snippets.

Type consistency:

- `ButtonComponent` exposes `pressed`, `type`, `variant`, `disabled`, `ariaLabel`, and `testId`.
- `InputComponent` and `CheckboxComponent` implement `ControlValueAccessor`.
- `FormFieldComponent` exposes `controlId`, `label`, `hint`, `error`, and `required`.
- `DataTableComponent` continues to expose the same public table inputs and outputs.

---

Plan complete and saved to `docs/superpowers/plans/2026-04-29-design-system-phase1-atomic-taxonomy.md`. Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.
