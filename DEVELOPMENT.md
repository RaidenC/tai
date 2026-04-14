# Development Guidelines

## Pre-commit & Pre-push Checklist

Before committing or pushing code to GitHub, verify the following:

### 1. Lint
```bash
npx nx run <project>:lint
```
- Must pass with 0 errors
- Warnings are acceptable but should be minimized

### 2. Tests
```bash
npx nx run <project>:test
```
- All tests must pass

### 3. E2E Tests (if applicable)
```bash
npx nx run <project>-e2e:e2e
```
- All e2e tests must pass
- Ensure correct port is configured (check for port conflicts)

## Port Configuration

| App | Port | Notes |
|-----|------|-------|
| borrower-portal | 4202 | Avoids conflict with docviewer-mock (4201) |
| portal-web | 4200 | |
| identity-ui | 4201 | Reserved for docviewer-mock |

## Common Issues

### Port Conflict
If e2e fails with wrong page content (e.g., "DocViewer Mock" instead of your app):
- Check if another app is using the same port
- Verify `playwright.config.ts` has correct `baseURL` and `url`
- For borrower-portal, ensure port is set to 4202

### Lint Errors - False Positives

#### Nx Dependency Checks
The `@nx/dependency-checks` rule may report false positives for peerDependencies:
- `The "@ngrx/store" package is not used by "disability-claim" project`

This happens because the linter checks if packages are directly imported, but peerDependencies are consumed differently. **CI will pass if the packages are actually imported in source code.**

To verify:
```bash
grep -r "@ngrx/store" libs/features/disability-claim/src/
```

If imports exist but lint still fails locally, check CI status - if CI passes, the lint error is a false positive.

### Lint Errors
Run `npx nx run <project>:lint --fix` to auto-fix common issues:
- Missing peer dependencies in package.json
- Unused variables
- Type annotations