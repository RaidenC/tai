# Design System Phase 2 CSP Dropdown Design

## Goal

Phase 2 adds the anti-Material proof point for the Portal design system: a responsive, accessible `tai-dropdown-menu` molecule that replaces CDK menu usage in `data-table`, `sidebar`, and `user-profile`, plus security documentation and a strict-CSP Storybook demonstration.

This phase depends on Phase 1 being complete. The spec assumes the design system has tiered folders under `libs/ui/design-system/src/lib/` and has the Phase 1 atoms available, especially `tai-button` and `tai-icon`.

## Scope

Phase 2 includes:

- Add `DropdownMenuComponent` as a Tier 2 molecule at `libs/ui/design-system/src/lib/molecules/dropdown-menu/`.
- Replace CDK menu usage in `libs/ui/design-system/src/lib/organisms/data-table/`.
- Replace CDK menu usage in `libs/ui/design-system/src/lib/organisms/sidebar/`.
- Replace CDK menu usage in `libs/ui/design-system/src/lib/organisms/user-profile/`.
- Remove `CdkMenuModule`, `cdkMenu`, `cdkMenuItem`, and `cdkMenuTriggerFor` from those components.
- Add `libs/ui/design-system/SECURITY.md`.
- Add a strict-CSP Storybook demo story for the dropdown and its consumers.
- Add tests and verification that prove the replacement is responsive, accessible, and free of runtime style injection patterns.

Phase 2 does not include:

- Building a universal popper/overlay positioning engine.
- Replacing Angular CDK table usage in `data-table`.
- Refactoring dialog, toast, notification panel, or transfer list behavior.
- Adding Angular Material compatibility.

## Design Direction

Use Approach A: a local-DOM dropdown molecule.

The dropdown keeps its trigger and panel in the normal Angular component tree. It does not use CDK overlay, Angular portals, `CdkMenuModule`, or runtime-computed inline positioning. The panel is positioned through static Tailwind/CSS classes and controlled Angular state.

This is the cleanest fit for the Phase 2 security narrative:

- Angular Material and CDK overlay-backed menus are avoided for strict CSP demonstration.
- Tailwind remains a build-time styling engine.
- The component is inspectable and auditable because the DOM is local and predictable.
- Responsive behavior is intentionally constrained to known Portal menu use cases.

## Component API

`DropdownMenuComponent` should expose a small API:

```typescript
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
```

Inputs:

```typescript
readonly items = input.required<DropdownMenuItem[]>();
readonly placement = input<DropdownPlacement>('bottom-end');
readonly mobileMode = input<DropdownMobileMode>('sheet');
readonly density = input<DropdownDensity>('comfortable');
readonly ariaLabel = input<string>('Menu');
readonly triggerLabel = input<string>('');
readonly triggerIcon = input<TaiIconName | null>(null);
readonly testId = input<string>('');
```

Outputs:

```typescript
readonly itemSelected = output<DropdownMenuItem>();
readonly opened = output<void>();
readonly closed = output<void>();
```

The component should render labels with text bindings only. It must not accept raw HTML labels or caller-provided style/class strings for menu items.

## Responsive Behavior

Desktop and tablet use anchored local positioning:

- The dropdown host is `position: relative`.
- The panel is `position: absolute`.
- `bottom-start`, `bottom-end`, `top-start`, and `top-end` map to static CSS classes.
- Panel width is constrained with `min-width` and `max-width`.
- Panel height is constrained and scrolls internally when content is long.
- The component must not compute or assign `top`, `left`, `right`, `bottom`, `transform`, `width`, or `height` through `[style]` or `style=""`.

Phone uses a CSS-driven action-sheet mode when `mobileMode="sheet"`:

- The panel is `position: fixed`.
- The panel uses safe viewport margins.
- The panel max height is `calc(100dvh - 2rem)`.
- The menu body scrolls internally.
- Menu items use large touch targets, with a practical target height of at least `44px`.

`mobileMode="inline"` is available for sidebar-like contexts where an inline expanding menu is a better small-screen interaction than a bottom sheet.

## Accessibility and UI/UX Requirements

The dropdown should follow the WAI-ARIA menu button pattern for action menus:

- Trigger is a real `button`, preferably through the Phase 1 `tai-button` atom.
- Trigger has `aria-haspopup="menu"`.
- Trigger exposes `aria-expanded` while open.
- Panel has `role="menu"`.
- Action items have `role="menuitem"`.
- Disabled items use `aria-disabled="true"` and are not selectable.
- `Enter` and `Space` open the menu from the trigger.
- `ArrowDown` opens the menu and focuses the first enabled item.
- `ArrowUp` opens the menu and focuses the last enabled item.
- `ArrowDown` and `ArrowUp` move among enabled menu items.
- `Home` and `End` jump to first and last enabled menu items.
- `Escape` closes the menu and returns focus to the trigger.
- `Tab` allows focus to leave and closes the menu.
- Clicking outside closes the menu.

The interaction should meet a modern admin-portal UI bar:

- Visible focus ring with sufficient contrast.
- Compact density for data-table row actions.
- Comfortable density for profile and sidebar menus.
- Clear destructive item styling.
- Clear active/current item styling.
- Reduced-motion support through `prefers-reduced-motion`.
- No layout shift when the menu opens.
- No clipped menu content on phone.

## Consumer Refactors

### Data Table

`DataTableComponent` should use `tai-dropdown-menu` for row actions.

Expected behavior:

- Each row action trigger remains reachable by test id.
- Row action menu uses `density="compact"`.
- Row action menu uses `placement="bottom-end"`.
- Selecting an item emits the existing `actionTriggered` output with the same payload shape.
- Existing sort and pagination behavior remains unchanged.
- `CdkMenuModule` is removed from the component imports.

### User Profile

`UserProfileComponent` should use `tai-dropdown-menu` for profile/account actions.

Expected behavior:

- Account menu opens from the existing profile trigger area.
- Menu uses `density="comfortable"`.
- Menu uses `placement="bottom-end"`.
- Menu uses `mobileMode="sheet"` for phone.
- Existing profile action outputs remain compatible.
- `CdkMenuModule` is removed from the component imports.

### Sidebar

`SidebarComponent` should replace CDK menu semantics with local dropdown or inline behavior.

Expected behavior:

- Desktop sidebar menus can use anchored dropdown behavior where the existing UI expects a popup.
- Mobile sidebar menus should prefer `mobileMode="inline"` when nested navigation is easier to scan in-place.
- Existing navigation item labels and route behavior remain compatible.
- `CdkMenuModule`, `cdkMenu`, and `cdkMenuItem` are removed.

## SECURITY.md

Add `libs/ui/design-system/SECURITY.md`.

It should document:

- The design-system security goal: strict CSP compatibility with no runtime style injection.
- Tailwind's role as build-time CSS, not a runtime UI system.
- Why Angular Material and CDK overlay-backed dropdowns were avoided for this POC.
- Approved patterns:
  - static Tailwind/CSS classes
  - Angular text interpolation
  - `[textContent]`
  - local DOM composition
  - typed item APIs
- Banned patterns:
  - `style=""`
  - `[style]`
  - `[innerHTML]`
  - `DomSanitizer.bypassSecurityTrust*`
  - runtime-generated Tailwind class names from user data
  - CDK overlay-backed dropdown/menu behavior in design-system components
- Review checklist for future atoms, molecules, and organisms.
- Verification commands for lint, test, build, Storybook, and static CSP scans.

## Strict-CSP Storybook Demo

Add a Storybook story such as:

```text
libs/ui/design-system/src/lib/security/strict-csp-demo.stories.ts
```

The story should render:

- `tai-dropdown-menu`
- `tai-data-table` with row actions
- `tai-user-profile`
- `tai-sidebar`

The story should attach a `securitypolicyviolation` listener and surface violations in the story UI. Where Storybook supports play-function assertions, the story should fail if a component-level violation is captured.

The spec should be honest about Storybook's own shell:

- Storybook itself may require a looser outer runtime than production.
- The Phase 2 demo validates the design-system component surface, local DOM behavior, and generated templates.
- Production CSP target remains documented in `SECURITY.md`.

## Testing Requirements

`DropdownMenuComponent` unit tests:

- creates successfully
- renders trigger and menu items
- opens and closes from trigger click
- emits selected item when enabled item is clicked
- does not emit for disabled item
- closes on outside click
- closes on `Escape` and returns focus to trigger
- supports arrow-key focus movement
- supports `Home` and `End`
- applies desktop placement classes
- applies mobile sheet classes
- renders item labels as text, not HTML

Consumer unit tests:

- `data-table` still emits existing row action payloads.
- `data-table` no longer imports or renders CDK menu directives.
- `user-profile` opens and selects profile actions through `tai-dropdown-menu`.
- `user-profile` no longer imports or renders CDK menu directives.
- `sidebar` navigation behavior still works.
- `sidebar` no longer imports or renders CDK menu directives.

Static scans:

```bash
rg -n "CdkMenuModule|cdkMenu|cdkMenuItem|cdkMenuTriggerFor" libs/ui/design-system/src/lib/organisms/data-table libs/ui/design-system/src/lib/organisms/sidebar libs/ui/design-system/src/lib/organisms/user-profile
rg -n "innerHTML|\\[style\\]|style=|DomSanitizer|bypassSecurityTrust" libs/ui/design-system/src/lib/molecules/dropdown-menu libs/ui/design-system/src/lib/security
```

Expected result:

- No CDK menu usage remains in the target consumers.
- No banned CSP escape hatches appear in the dropdown or strict-CSP demo implementation.

Cross-project verification:

```bash
CI=true npx nx lint design-system --skip-nx-cache
CI=true npx nx test design-system --skip-nx-cache
CI=true npx nx build design-system --skip-nx-cache
CI=true npx nx build-storybook design-system --skip-nx-cache
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

All e2e commands are required to pass before Phase 2 is considered complete.

## Risks and Constraints

The dropdown is intentionally not a full overlay engine. It will not auto-flip through arbitrary viewport placements the way a popper-style engine can. This is acceptable because Phase 2 targets known Portal menu surfaces with predictable layouts.

Mobile behavior must not be treated as a smaller desktop dropdown. The bottom-sheet mode is required for production-quality phone behavior.

Replacing CDK menu usage means the design system owns keyboard interaction. Tests must cover the expected ARIA menu-button behavior so accessibility does not regress.

Phase 2 depends on Phase 1 paths and atoms. If Phase 1 changes component names or file paths, the Phase 2 implementation plan must align with the landed Phase 1 code before execution.

## Success Criteria

Phase 2 is successful when:

- `tai-dropdown-menu` exists as a Tier 2 molecule.
- `data-table`, `sidebar`, and `user-profile` no longer use CDK menu APIs.
- Responsive dropdown behavior works on desktop, tablet, and phone.
- Keyboard and focus behavior matches the expected menu-button pattern.
- `SECURITY.md` explains the strict CSP design-system rules and anti-Material rationale.
- The strict-CSP Storybook demo exists and surfaces component-level CSP violations.
- Static scans show no CDK menu usage in the target consumers.
- Static scans show no banned CSP escape hatches in the new dropdown and security demo.
- Design-system lint, tests, build, and Storybook build pass.
