# Design-System Storybook Failure Hardening

## Goal

Make the existing design-system Storybook browser gate pass without weakening its axe accessibility or CSP checks.

## Findings

- UserProfile and AppShell fail `color-contrast` for the profile initials rendered with `bg-blue-500` and white text.
- RegistrationForm fails `link-in-text-block` for the indigo Terms of Service link.
- TransferList fails repeated accessibility checks and emits inline `view-transition-name` styles from its own template.
- NotificationPanel fails repeated accessibility checks and emits an inline animation style from its own template.
- DataTable emits one inline style per failing story, but its template has no inline-style binding; the runtime DOM must identify the descendant before changing code.
- PendingApprovalsTile has one accessibility failure in each of its two story states and must be diagnosed from the axe rule/node output before changing markup.

## Approach

Use existing Tailwind utility classes for static colors, spacing, layout, focus states, and contrast fixes. Keep component SCSS for keyframes and component-specific animation where Tailwind cannot express the existing behavior. Remove or redesign dynamic inline styles that conflict with the repository's CSP guardrail.

Fix one root cause at a time, add focused component-test assertions where they protect the repaired behavior, and use `design-system:test-storybook` as the acceptance test. Do not add axe exclusions, CSP exclusions, or story-only bypasses.

## Acceptance Criteria

1. `npx nx run design-system:test-storybook --skip-nx-cache` exits 0.
2. The existing design-system unit suite passes.
3. No `[style]` elements remain under `#storybook-root` for the affected stories.
4. The custom axe and CSP checks remain unchanged and active.
