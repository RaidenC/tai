# Design-System Storybook CI Gate

## Objective

Make the design-system Storybook interaction suite a reproducible Nx target and a required CI gate whenever Nx marks the design system as affected. The gate must execute story `play` functions and the existing axe and CSP hooks.

## Current State

- `design-system` defines `storybook` and `build-storybook` targets but no executable `test-storybook` target.
- `.storybook/test-runner.ts` defines axe accessibility checks and a no-inline-style CSP check.
- `@storybook/test-runner` is referenced by configuration but is not a direct dependency and its CLI is unavailable.
- CI runs affected unit tests, but it does not start Storybook or execute Storybook interactions.

## Design

### Nx Target

Add a `test-storybook` target to `libs/ui/design-system/project.json`.

The target will:

1. Depend on `build-storybook` so the static application is current.
2. Start a static HTTP server for `dist/storybook/design-system` on a dedicated port.
3. Wait until the server is reachable.
4. Run the Storybook test-runner against that URL using the existing Storybook configuration.
5. Terminate the server whether tests pass or fail.

Server lifecycle orchestration will use a maintained command-line utility rather than background-process shell logic. Required tools will be direct development dependencies so local and CI behavior use locked versions.

### CI Integration

Add a step to the existing `ci` job that determines whether `design-system` is affected. When it is affected, the step will install the required Chromium runtime and run the `design-system:test-storybook` target. When it is not affected, it will print a skip message and succeed without installing a browser or building Storybook.

The target remains directly runnable locally, independent of affected-project detection.

### Failure Semantics

The Nx target and CI step must return a nonzero exit status when any of these fail:

- Storybook compilation
- Static server startup
- Story `play` function assertions
- Axe accessibility checks
- CSP checks from `.storybook/test-runner.ts`

The server must not remain running after completion or failure.

## Verification

1. Confirm Nx exposes `design-system:test-storybook`.
2. Run the target locally against the built static Storybook.
3. Confirm all current stories execute or document pre-existing story failures exposed by activating the gate.
4. Temporarily introduce a controlled failing assertion or equivalent diagnostic to prove failure propagation, then revert it.
5. Run the design-system unit-test baseline to ensure configuration changes do not affect TestBed tests.
6. Validate workflow syntax and inspect the affected-only branch condition.

## Scope

This change activates existing Storybook tests. It does not repair story, accessibility, or CSP failures discovered once the gate runs; those failures will be handled explicitly rather than weakened or suppressed.

