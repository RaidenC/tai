# SWBC CSP Custom Components vs Angular Material Narrative

## Core Interview Narrative

SWBC chose a custom Angular component library over Angular Material because the security posture required strict, zero-violation Content Security Policy behavior.

The key constraint was a CSP profile like:

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

The practical rule was: no `unsafe-inline`, no `unsafe-eval`, and no runtime style or script escape hatches.

Angular Material and some Angular CDK systems can be difficult to fit into that model because Material menus, dialogs, tooltips, snackbars, autocomplete, ripples, and overlay-backed behavior depend on runtime UI systems. The concern is not that Angular Material is insecure by default. The concern is that Material/CDK overlay-backed behavior can introduce generated DOM, runtime positioning, and style behavior that is hard to audit under a strict `style-src 'self'` posture.

The custom component library gave the team control over:

- DOM structure
- styling strategy
- runtime behavior
- accessibility behavior
- dependency surface
- upgrade risk
- security review scope

## Strong Interview Phrasing

Use this version:

> Angular Material's prebuilt components are useful, but for our fintech portal we had a strict CSP requirement: static styles from `self`, no inline styles, no unsafe script behavior, and no operational dependence on nonce/hash exceptions. Material and CDK overlay-backed primitives can require runtime positioning and generated UI behavior that is harder to prove under that CSP. We built a custom headless Angular component library styled with Tailwind at build time, so all styles shipped as static CSS and the component DOM remained reviewable. That reduced CSP regression risk, third-party audit surface, and supply-chain exposure.

Shorter version:

> Tailwind gave us Material-like design consistency without Material's runtime security cost.

Fallback if challenged:

> We did not treat all CDK usage equally. Structural primitives such as CDK table can be acceptable case by case. The concern was overlay-backed primitives like menus, popovers, tooltips, dialogs, and snackbars, where runtime positioning can conflict with a strict no-inline-style CSP. So we replaced CDK menu/overlay behavior while keeping structural CDK usage under review.

## Angular Material and CSP Conflict

The strongest technical conflict is runtime UI behavior:

- Material/CDK overlay-backed components create floating UI outside normal local DOM.
- Overlay positioning may depend on runtime placement decisions.
- Material ripple and animation behaviors can involve dynamic style changes.
- Theme/runtime styling paths can expand the audit surface.
- Upgrades can reintroduce CSP regressions.

The issue is not "Angular Material is bad." The issue is:

> A strict fintech CSP makes runtime UI systems a long-term audit and regression risk.

## Tailwind's Role

Tailwind was not chosen as a replacement component library. It was chosen as the low-level styling engine for custom components.

Architecture:

```text
Tailwind tokens/utilities
        ↓
Tier 1 atoms
        ↓
Tier 2 molecules
        ↓
Tier 3 organisms
        ↓
Portal-Web feature screens
```

The important distinction:

```text
Angular Material = prebuilt behavior + runtime UI systems
Tailwind = build-time CSS utility system
```

Tailwind supports the CSP story when used correctly because it compiles utility classes into static CSS served from `self`.

Rules:

- Do not generate Tailwind class names from user input.
- Do not use runtime style bindings for layout.
- Do not use arbitrary values sourced from untrusted data.
- Keep design tokens in Tailwind config/presets and component source.
- Use static classes and component state variants.

## Angular CDK vs Headless Angular

Angular CDK is the official Angular component development kit. It provides low-level primitives like:

- `CdkTableModule`
- `CdkMenuModule`
- `OverlayModule`
- `PortalModule`
- focus utilities
- drag/drop
- virtual scroll

It is "headless-ish" because it often provides behavior without Material styling, but it is still an external runtime toolkit with its own DOM and behavior patterns.

Headless Angular is an architectural style, not a specific package. It means custom Angular components own behavior and accessibility while styling comes from the project's design system and Tailwind.

Example distinction:

```text
Angular CDK:
Official Angular behavior toolkit.
Useful, but overlay-backed features can create CSP concerns.

Headless Angular:
Custom component architecture.
The team owns DOM, behavior, accessibility, Tailwind styling, and CSP guarantees.
```

Best phrasing:

> We used a headless Angular component approach: custom behavior-first components styled by Tailwind at build time. We avoided Angular Material and minimized CDK overlay-backed primitives where strict CSP made runtime positioning and style injection risky.

## CDK Table vs CDK Menu

Not all CDK usage has the same risk.

`CdkTableModule` is mostly a structural rendering primitive:

- renders table structure from Angular templates
- keeps DOM local
- does not require a popup overlay container
- usually fits the POC security story

The caveat is sticky table features. Sticky headers or sticky columns should be audited before claiming strict zero-inline-style compliance, because sticky behavior may involve measurement and style application.

`CdkMenuModule` and `cdkMenuTriggerFor` are different:

- they support popup/floating menu behavior
- they may depend on overlay-style positioning
- they are harder to explain under a strict CSP story

Recommended stance:

> Keep CDK table for now as a structural primitive. Remove CDK menu/overlay-backed behavior from security-critical design-system components.

## Phase 2 Dropdown Story

The Phase 2 dropdown menu exists to prove the anti-Material point.

`tai-dropdown-menu` should:

- be a Tier 2 molecule
- keep trigger and panel in local DOM
- avoid CDK menu, CDK overlay, and portals
- use static Tailwind/CSS classes
- support desktop/tablet anchored dropdowns
- support phone action-sheet mode
- provide keyboard and focus behavior directly
- render labels as text only
- avoid `[innerHTML]`, `[style]`, and `style=""`

Responsive behavior:

```text
Desktop/tablet:
local anchored menu with placement variants.

Phone:
CSS-driven bottom action sheet or inline mode.

No CDK overlay:
no portal container, no runtime inline positioning, no style injection.
```

2026 UI/UX baseline:

- clear focus ring
- `Enter` / `Space` opens and activates
- `Escape` closes and returns focus
- arrow keys move through items
- `Home` / `End` jump
- outside click closes
- `Tab` exits and closes
- disabled/destructive/active states
- reduced motion support
- viewport-safe panel sizing
- practical touch targets of at least 44px

Interview phrasing:

> We did not need Material/CDK overlay to get responsive menus. Our dropdown molecule uses local CSS positioning on desktop/tablet and a CSS-driven action-sheet layout on mobile. All positioning comes from static classes and media queries, so it remains compatible with `style-src 'self'`.

## Component Taxonomy Tie-In

The custom library should show the 3-tier structure clearly:

- Tier 1 atoms: `button`, `input`, `checkbox`, `icon`, `label`, `secure-input`
- Tier 2 molecules: `form-field`, `dropdown-menu`, dialogs, tiles, alerts
- Tier 3 organisms: `data-table`, `transfer-list`, `login-form`, `registration-form`, `notification-panel`, `wizard`, `app-shell`

`data-table` and `transfer-list` are Tier 3 organisms because they aggregate smaller components and carry significant behavior: sorting, pagination, filtering, selection, virtualization, or paired-list movement.

The POC should make composition visible:

```text
login-form
  → form-field
    → label + secure-input
      → input
  → button

data-table
  → button
  → icon
  → dropdown-menu
```

## Security Requirements Demonstrated By Custom Components

Atoms:

- no inline styles
- no `[innerHTML]`
- labels and inputs use accessible attributes
- `secure-input` controls autocomplete and sensitive identity-field behavior
- icons are self-owned and do not require third-party icon runtime behavior

Molecules:

- `form-field` renders errors with text only
- `dropdown-menu` replaces overlay-backed menu behavior
- positioning is CSS-driven, not runtime style-driven

Organisms:

- `login-form` composes secure inputs and typed reactive forms
- `data-table` composes atoms/molecules for row actions
- privilege-aware views can use `has-privilege` without leaking unauthorized UI actions

Docs and tests:

- `SECURITY.md` defines approved and banned patterns
- Storybook strict-CSP demo exercises the component surface
- static scans check for `style=`, `[style]`, `[innerHTML]`, and CDK menu/overlay usage

## Honest Caveats

Do not overclaim.

- Angular Material can be made CSP-compatible in some configurations.
- Nonces and hashes can support stricter CSP deployments, but they add operational complexity.
- Angular CDK is not categorically unsafe.
- CDK structural primitives can be allowed case by case.
- Storybook itself may require a looser outer shell than production.

The defensible claim is:

> For a fintech portal with strict, zero-violation CSP goals, custom headless Angular components styled by build-time Tailwind CSS gave us a smaller, more auditable, more stable security surface than Angular Material or overlay-backed CDK UI primitives.
