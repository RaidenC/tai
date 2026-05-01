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
