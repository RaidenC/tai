# Design-System Molecule Test Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move consumer-visible molecule coverage into Storybook, retain only non-rendered Vitest coverage, and compose molecules from design-system atoms where the atom supports the required behavior.

**Architecture:** Each existing molecule story remains the primary rendered test fixture. Storybook `play()` functions use semantic queries, `userEvent`, `expect`, and `fn()` output spies. Vitest specs are deleted when they only exercise the DOM; service tests and the confirmation-panel architectural boundary check remain in focused files. Native elements remain for menu, table, dialog, and projected-content semantics when `tai-button` or another atom cannot provide the required contract.

**Tech Stack:** Angular 21, Nx, Storybook 8.6, `@storybook/test`, `@storybook/addon-interactions`, `@storybook/test-runner`, Vitest, and the existing Tailwind build.

---

## Task 1: Establish the Baseline

**Files:**
- Read: `docs/superpowers/specs/2026-08-27-design-system-molecule-test-ownership-design.md`
- Read: `libs/ui/design-system/src/lib/molecules/**/*.{ts,html}`

- [ ] **Step 1: Confirm the worktree and current branch.**

Run:

```bash
git status --short --branch
```

Expected: branch `test/reorganize-test-ownership` with no uncommitted implementation changes.

- [ ] **Step 2: Run the current molecule unit and Storybook gates.**

Run:

```bash
npx nx run design-system:test --skip-nx-cache
npx nx run design-system:test-storybook --skip-nx-cache
```

Record the current passing test counts and preserve any pre-existing warnings for comparison. Do not change code in this task.

## Task 2: Migrate ConfirmationPanel and ConfirmationDialog

**Files:**
- Modify: `libs/ui/design-system/src/lib/molecules/confirmation-panel/confirmation-panel.component.ts`
- Modify: `libs/ui/design-system/src/lib/molecules/confirmation-panel/confirmation-panel.component.html`
- Modify: `libs/ui/design-system/src/lib/molecules/confirmation-panel/confirmation-panel.stories.ts`
- Create: `libs/ui/design-system/src/lib/molecules/confirmation-panel/confirmation-panel.architecture.spec.ts`
- Delete: `libs/ui/design-system/src/lib/molecules/confirmation-panel/confirmation-panel.component.spec.ts`
- Modify: `libs/ui/design-system/src/lib/molecules/confirmation-dialog/confirmation-dialog.stories.ts`
- Delete: `libs/ui/design-system/src/lib/molecules/confirmation-dialog/confirmation-dialog.spec.ts`

- [ ] **Step 1: Add Storybook assertions before removing the DOM tests.**

Extend the existing stories with assertions for:

- default dialog role, modal state, labelled title, and described message
- danger warning text, danger styling, and cancel-first initial-focus configuration
- long title/message rendering without losing action controls
- loading text `Working...`, disabled confirm and cancel controls, and no emitted action
- disabled cancel and confirm actions
- empty title/message/action labels falling back to safe defaults
- title/message truncation at 120/500 characters
- literal security strings remaining text rather than creating `img` or `script` elements
- confirm and cancel `actionSelected` payloads, with duplicate clicks producing one call

Use the Storybook args spy in the play function:

```ts
play: async ({ args, canvasElement }) => {
  const canvas = within(canvasElement);
  const cancel = canvas.getByRole('button', { name: 'Cancel' });

  await userEvent.click(cancel);
  await expect(args.actionSelected).toHaveBeenCalledWith({ action: 'cancel' });
}
```

Each story that clicks an action must assert the payload or explicitly assert that no payload was emitted for a disabled/loading action.

- [ ] **Step 2: Add the atom-composition test for confirmation actions.**

Add a Storybook assertion that the rendered confirmation actions contain `tai-button` hosts and native button elements with the expected accessible names. Then run the focused story:

```bash
npx nx run design-system:test-storybook --skip-nx-cache
```

The new `tai-button` assertion must fail against the current native-button implementation. This is the required red step for the composition change.

- [ ] **Step 3: Compose confirmation actions from `tai-button`.**

Import `ButtonComponent` into `ConfirmationPanelComponent` and replace the two action `<button>` elements with:

```html
<tai-button
  type="button"
  variant="secondary"
  [disabled]="vm.cancelDisabled"
  (pressed)="select('cancel')"
  data-confirmation-focus="cancel"
  testId="modal-cancel-button"
>
  <span [textContent]="vm.cancelLabel"></span>
</tai-button>

<tai-button
  type="button"
  [variant]="vm.tone === 'danger' ? 'danger' : 'primary'"
  [disabled]="vm.confirmDisabled"
  (pressed)="select('confirm')"
  data-confirmation-focus="confirm"
  testId="modal-confirm-button"
>
  <span [textContent]="vm.confirmLoading ? 'Working...' : vm.confirmLabel"></span>
</tai-button>
```

Remove the obsolete button-class methods after the stories prove the atom variants preserve the public states. Keep the panel’s dialog markup native.

- [ ] **Step 4: Verify ConfirmationPanel stories and preserve the architecture guard.**

Run the focused Storybook target and confirm the newly added plays pass. Move the existing source-level check that the panel does not import CDK dialog/overlay/a11y or Material primitives into `confirmation-panel.architecture.spec.ts`. The new spec must contain only that source-boundary test and no TestBed fixture.

Run:

```bash
npx nx run design-system:test-storybook --skip-nx-cache
npx nx run design-system:test --skip-nx-cache
```

- [ ] **Step 5: Add compatibility-wrapper Storybook coverage.**

Extend `confirmation-dialog.stories.ts` with separate confirm and cancel interaction stories. Supply a `DialogRef.close` `fn()` through the existing provider and assert `true` after the confirm click and `false` after the cancel click. Also assert the legacy title, message, confirm label, and cancel label. Keep the deprecated wrapper story visible in Storybook.

- [ ] **Step 6: Remove duplicate ConfirmationDialog DOM tests.**

Delete `confirmation-dialog.spec.ts` after the compatibility stories pass. Do not add a replacement TestBed spec for rendered labels or button clicks.

## Task 3: Migrate DropdownMenu

**Files:**
- Modify: `libs/ui/design-system/src/lib/molecules/dropdown-menu/dropdown-menu.stories.ts`
- Delete: `libs/ui/design-system/src/lib/molecules/dropdown-menu/dropdown-menu.component.spec.ts`
- Read: `libs/ui/design-system/src/lib/molecules/dropdown-menu/dropdown-menu.component.ts`
- Read: `libs/ui/design-system/src/lib/molecules/dropdown-menu/dropdown-menu.component.html`

- [ ] **Step 1: Expand the existing story fixture.**

Keep native menu buttons because the component requires menu and menuitem semantics that the current `tai-button` atom does not provide. Add default items for enabled, disabled, destructive, and literal HTML labels. Wire `itemSelected`, `opened`, and `closed` to Storybook `fn()` args.

- [ ] **Step 2: Add failing Storybook plays for the missing public behaviors.**

Add plays that assert:

- trigger click opens the menu and updates `aria-expanded`
- `opened` and `closed` emit once
- enabled selection emits the complete item object, closes the menu, and restores trigger focus
- disabled selection emits nothing
- literal HTML labels remain text and do not create an `img` element
- Escape closes and restores focus
- outside click closes the menu
- Home, End, ArrowDown, and ArrowUp move focus among enabled items
- top-start, bottom-start, top-end, and bottom-end placement classes are applied
- compact density and both mobile modes render their expected classes

Use semantic queries for triggers, menus, and menuitems. Use `queryByRole('menu')` only when asserting absence.

- [ ] **Step 3: Run the Storybook gate and fix only story/component issues exposed by the new plays.**

Run:

```bash
npx nx run design-system:test-storybook --skip-nx-cache
```

Expected during the red step: the new output and missing-behavior assertions fail until their Storybook wiring or existing component behavior is corrected.

- [ ] **Step 4: Remove the duplicate TestBed spec.**

Delete `dropdown-menu.component.spec.ts` after all dropdown plays pass. The component has no pure function, service, or non-rendered transformation that requires a remaining unit spec.

## Task 4: Migrate FormField

**Files:**
- Modify: `libs/ui/design-system/src/lib/molecules/form-field/form-field.stories.ts`
- Delete: `libs/ui/design-system/src/lib/molecules/form-field/form-field.component.spec.ts`
- Read: `libs/ui/design-system/src/lib/molecules/form-field/form-field.component.ts`
- Read: `libs/ui/design-system/src/lib/molecules/form-field/form-field.component.html`

- [ ] **Step 1: Preserve atom composition in the story host.**

Keep `tai-label` and `tai-input` in the projected story template. Add a stable input label/id pairing and use the `tai-input` accessible control rather than a raw input.

- [ ] **Step 2: Add Storybook plays for the current public contract.**

Add stories or plays for:

- label `for` matching the projected input id
- required marker present and absent
- hint present and absent
- error present and absent
- error role `alert` and `aria-live="polite"`
- literal hint/error strings remaining text instead of HTML
- projected input content being present
- host `block w-full` classes

Do not add an assertion for automatic `aria-describedby` wiring in this task. The component currently computes `describedBy` without applying it to projected content; that requires a separate API/design decision documented in the spec.

- [ ] **Step 3: Run the FormField stories and remove the duplicate spec.**

Run:

```bash
npx nx run design-system:test-storybook --skip-nx-cache
```

After the stories pass, delete `form-field.component.spec.ts`. No TestBed DOM replacement is needed.

## Task 5: Migrate CryptoUnavailable

**Files:**
- Modify: `libs/ui/design-system/src/lib/molecules/crypto-unavailable/crypto-unavailable.stories.ts`
- Delete: `libs/ui/design-system/src/lib/molecules/crypto-unavailable/crypto-unavailable.spec.ts`

- [ ] **Step 1: Strengthen the existing stories.**

In the default story, query `getByRole('alert')` and assert `aria-live="assertive"`, the heading, and the HTTPS guidance. In the custom-message story, assert the custom message through the alert role and verify the default message is replaced at the input location.

- [ ] **Step 2: Run the Storybook gate and delete the duplicate spec.**

Run:

```bash
npx nx run design-system:test-storybook --skip-nx-cache
```

Delete `crypto-unavailable.spec.ts` after the stories pass.

## Task 6: Migrate PendingApprovalsTile and Compose the Button Atom

**Files:**
- Modify: `libs/ui/design-system/src/lib/molecules/pending-approvals-tile/pending-approvals-tile.ts`
- Modify: `libs/ui/design-system/src/lib/molecules/pending-approvals-tile/pending-approvals-tile.html`
- Modify: `libs/ui/design-system/src/lib/molecules/pending-approvals-tile/pending-approvals-tile.stories.ts`
- Delete: `libs/ui/design-system/src/lib/molecules/pending-approvals-tile/pending-approvals-tile.spec.ts`

- [ ] **Step 1: Add the failing atom-composition and output assertions to the stories.**

Wire `approved` to a Storybook `fn()` and add plays that assert the pending users, count, table headers, empty state, and `approved` payload. Add an assertion that each approval control renders through `tai-button` and remains accessible as a button named `Approve`.

- [ ] **Step 2: Run the focused story to verify the composition assertion fails.**

Run:

```bash
npx nx run design-system:test-storybook --skip-nx-cache
```

The `tai-button` assertion must fail before the component template is changed.

- [ ] **Step 3: Replace the raw approval button with `tai-button`.**

Import `ButtonComponent` and add it to the standalone component imports. Replace the raw approval button with:

```html
<tai-button
  type="button"
  variant="primary"
  (pressed)="onApprove(user.id)"
  testId="approve-button"
>
  Approve
</tai-button>
```

Keep the table and headings native. Do not use `tai-button` for table structure.

- [ ] **Step 4: Verify and remove the duplicate TestBed spec.**

Run the Storybook gate, confirm the payload contains the selected user id, and delete `pending-approvals-tile.spec.ts` after the stories pass.

## Task 7: Migrate SecurityAlert

**Files:**
- Modify: `libs/ui/design-system/src/lib/molecules/security-alert/security-alert.ts`
- Modify: `libs/ui/design-system/src/lib/molecules/security-alert/security-alert.stories.ts`
- Delete: `libs/ui/design-system/src/lib/molecules/security-alert/security-alert.spec.ts`

- [ ] **Step 1: Add a real Storybook output spy.**

Set `dismissed: fn()` in the dismissible story args. Use `getByRole('alert')` and `getByRole('button', { name: 'Dismiss alert' })`. After `userEvent.click`, assert `args.dismissed` was called exactly once. Do not assert that the alert disappears, because visibility is controlled by the parent through the `visible` input.

- [ ] **Step 2: Add semantic and security assertions.**

Assert warning and info variants through visible state, hidden state through absence of the alert, `aria-live="polite"`, literal message rendering, and the dismiss button’s accessible name. Use a malicious-looking message in one story and verify no `script` element is created.

- [ ] **Step 3: Compose the dismiss control from `tai-button`.**

Import `ButtonComponent` and replace the raw dismiss control with a ghost `tai-button` carrying `ariaLabel="Dismiss alert"` and a visible `Dismiss` label. Remove the obsolete raw dismiss-button CSS from the component’s inline style block. Keep the alert container native with `role="alert"`.

- [ ] **Step 4: Run Storybook and remove the placeholder spec.**

Run:

```bash
npx nx run design-system:test-storybook --skip-nx-cache
```

Delete `security-alert.spec.ts`. The placeholder test must not remain as a false coverage signal.

## Task 8: Migrate Toast While Keeping ToastService Unit Tests

**Files:**
- Modify: `libs/ui/design-system/src/lib/molecules/toast/toast.component.ts`
- Modify: `libs/ui/design-system/src/lib/molecules/toast/toast.stories.ts`
- Create: `libs/ui/design-system/src/lib/molecules/toast/toast.service.spec.ts`
- Delete: `libs/ui/design-system/src/lib/molecules/toast/toast.spec.ts`

- [ ] **Step 1: Split and strengthen service tests first.**

Move the `ToastService` describe block into `toast.service.spec.ts`. Keep tests for creation, default info severity, explicit warning/critical severity, timestamp creation, replacement of the current toast by a later `show()`, and `hide()`. Use a local `const toast = service.toast()` guard before reading properties instead of non-null assertions.

- [ ] **Step 2: Add Storybook coverage for all component states.**

Add an `Empty` story that renders `tai-toast` without first showing a service toast. Extend Info, Warning, and Critical to assert visible messages, semantic dismiss button, and severity state. Extend Dismissible to click the close control with `userEvent` and assert the message is removed.

The existing Storybook host must continue to inject the same `ToastService` instance used by `tai-toast`; do not instantiate a separate service in `play()`.

- [ ] **Step 3: Remove dead component-method coverage.**

Search the repository for `getSeverityClass`. If there are no consumers, remove the method from `ToastComponent` and remove its unit tests. The Storybook tests must assert the rendered severity behavior, not the helper method.

- [ ] **Step 4: Run the focused service and Storybook tests.**

Run:

```bash
npx nx run design-system:test --skip-nx-cache
npx nx run design-system:test-storybook --skip-nx-cache
```

After both pass, delete `toast.spec.ts`; retain `toast.service.spec.ts` as the only Toast Vitest file.

## Task 9: Complete NotificationToggle Story Coverage

**Files:**
- Modify: `libs/ui/design-system/src/lib/molecules/notification-toggle/notification-toggle.stories.ts`

- [ ] **Step 1: Keep the existing Storybook-only ownership.**

Do not create a TestBed spec. The current stories already cover badge display, open state, connection indicators, ARIA labels, click behavior, and two placements.

- [ ] **Step 2: Add the remaining public placement states.**

Add `TopRight` and `BottomLeft` stories with host class assertions. Keep `NoUnread` as the interaction story and assert the `toggled` spy through the story args. Clear or scope the spy so results from one story cannot affect another.

- [ ] **Step 3: Run the notification-toggle story file through the existing Storybook gate.**

Run:

```bash
npx nx run design-system:test-storybook --skip-nx-cache
```

## Task 10: Final Test-Ownership and Atom Audit

**Files:**
- Read: `libs/ui/design-system/src/lib/molecules`
- Read: all changed molecule stories and specs

- [ ] **Step 1: Verify no duplicate rendered component specs remain.**

Run:

```bash
rg --files libs/ui/design-system/src/lib/molecules | rg '\.spec\.ts$|\.stories\.ts$' | sort
```

Confirm the remaining Vitest files are exactly `confirmation-panel.architecture.spec.ts` and `toast.service.spec.ts`. If implementation reveals another non-rendered behavior that must remain in Vitest, stop before deleting its spec, document the behavior and ownership decision in the plan or final diff, and update this audit expectation.

- [ ] **Step 2: Verify atom usage and intentional native elements.**

Search the molecule templates for raw controls and classify each remaining native element:

```bash
rg -n '<button|<input|<svg|<tai-button|<tai-icon|<tai-label|<tai-input' libs/ui/design-system/src/lib/molecules --glob '*.html' --glob '*.ts'
```

Confirm `tai-button` is used for suitable molecule actions, `tai-label`/`tai-input` remain used in FormField composition, and native menu/table/dialog/projected-content elements remain only where required by semantics or unsupported atom behavior.

- [ ] **Step 3: Run the complete verification suite.**

Run:

```bash
npx nx run design-system:lint --skip-nx-cache
npx nx run design-system:test --skip-nx-cache
npx nx run design-system:test-storybook --skip-nx-cache
git diff --check
```

Expected: lint exits with zero errors, Vitest passes all remaining service/architecture tests, Storybook builds and runs all discovered stories successfully, and `git diff --check` reports no whitespace errors.

- [ ] **Step 4: Review the final diff against the design spec.**

Confirm that public rendered behavior moved to stories, service/architecture logic stayed in Vitest, no coverage was removed without an equivalent Storybook assertion, the FormField `describedBy` issue remains explicitly out of scope, and no Storybook/testing architecture or dependency versions changed.
