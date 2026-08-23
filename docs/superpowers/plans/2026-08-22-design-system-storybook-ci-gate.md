# Design-System Storybook CI Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an affected-only CI gate that executes all design-system Storybook play functions plus the existing axe and CSP test-runner hooks.

**Architecture:** An explicit Nx `test-storybook` target will depend on the static Storybook build, serve its output on port 6007, and run Storybook's browser test runner with reliable process cleanup. GitHub Actions will use Nx affected-project detection before installing Chromium or invoking the target.

**Tech Stack:** Nx 22, Angular 21, Storybook 8.6, `@storybook/test-runner` 0.22.1, Playwright Chromium, `http-server`, `start-server-and-test`, GitHub Actions.

---

## File Map

- Modify `package.json`: declare the Storybook runner and static-server lifecycle tools.
- Modify `package-lock.json`: lock the new development dependencies.
- Modify `libs/ui/design-system/project.json`: define the reproducible Nx target.
- Modify `.github/workflows/main.yml`: add affected detection, conditional browser installation, and the CI gate.

### Task 1: Add compatible Storybook test tooling

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Prove the runner CLI is currently unavailable**

Run:

```bash
test ! -x node_modules/.bin/test-storybook
```

Expected: PASS because the command is not currently installed.

- [ ] **Step 2: Install compatible, locked development dependencies**

Run:

```bash
npm install --save-dev @storybook/test-runner@0.22.1 http-server@14.1.1 start-server-and-test@3.0.12 --legacy-peer-deps
```

Expected: `package.json` and `package-lock.json` change, and npm completes successfully. Version 0.22.1 is required because its peer range includes Storybook 8.6; the current latest test-runner requires Storybook 10.

- [ ] **Step 3: Verify the runner is installed directly**

Run:

```bash
npm ls @storybook/test-runner http-server start-server-and-test --depth=0
```

Expected: all three packages appear with the exact requested versions.

- [ ] **Step 4: Commit the dependency change**

```bash
git add package.json package-lock.json
git commit -m "test: add Storybook browser test tooling"
```

### Task 2: Add the reproducible Nx Storybook test target

**Files:**
- Modify: `libs/ui/design-system/project.json:56`

- [ ] **Step 1: Prove the target is currently missing**

Run:

```bash
npx nx show project design-system --json | jq -e '.targets["test-storybook"]'
```

Expected: FAIL because no `test-storybook` target exists.

- [ ] **Step 2: Add the target after `build-storybook`**

Add this target to `libs/ui/design-system/project.json`:

```json
"test-storybook": {
  "executor": "nx:run-commands",
  "dependsOn": ["build-storybook"],
  "options": {
    "command": "start-server-and-test \"http-server dist/storybook/design-system -p 6007 -c-1 --silent\" http://127.0.0.1:6007 \"test-storybook --url http://127.0.0.1:6007 --config-dir libs/ui/design-system/.storybook\""
  }
}
```

The lifecycle utility must terminate the HTTP server after both success and failure.

- [ ] **Step 3: Verify Nx resolves the target**

Run:

```bash
npx nx show project design-system --json | jq -e '.targets["test-storybook"].executor == "nx:run-commands"'
```

Expected: `true` and exit code 0.

- [ ] **Step 4: Execute the target**

Run:

```bash
npx nx run design-system:test-storybook
```

Expected: Storybook builds, the static server starts on port 6007, all stories are visited, and play/axe/CSP results are reported. Any existing product or story failures must be recorded and fixed separately rather than bypassed.

- [ ] **Step 5: Confirm server cleanup**

Run:

```bash
! curl --fail --silent http://127.0.0.1:6007
```

Expected: PASS because no server remains after the target exits.

- [ ] **Step 6: Commit the Nx target**

```bash
git add libs/ui/design-system/project.json
git commit -m "test: add design-system Storybook target"
```

### Task 3: Add affected-only CI execution

**Files:**
- Modify: `.github/workflows/main.yml:109`

- [ ] **Step 1: Add affected-project detection after unit tests**

Add these steps to the existing `ci` job after `Test Affected`:

```yaml
      - name: Detect affected Storybook projects
        id: affected-storybook
        shell: bash
        run: |
          if npx nx show projects --affected --with-target test-storybook | grep -Fxq design-system; then
            echo "run_design_system=true" >> "$GITHUB_OUTPUT"
          else
            echo "run_design_system=false" >> "$GITHUB_OUTPUT"
            echo "Design system is not affected; skipping Storybook tests."
          fi

      - name: Install Storybook test browser
        if: steps.affected-storybook.outputs.run_design_system == 'true'
        run: npx playwright install --with-deps chromium

      - name: Test affected design-system stories
        if: steps.affected-storybook.outputs.run_design_system == 'true'
        run: npx nx run design-system:test-storybook
```

- [ ] **Step 2: Validate workflow parsing**

Run:

```bash
npx prettier --check .github/workflows/main.yml
```

Expected: exit code 0. If Prettier reports formatting differences, run `npx prettier --write .github/workflows/main.yml` and repeat the check.

- [ ] **Step 3: Verify the affected command recognizes the target**

Run:

```bash
npx nx show projects --with-target test-storybook
```

Expected: output contains exactly `design-system` among projects with that target.

- [ ] **Step 4: Commit the CI gate**

```bash
git add .github/workflows/main.yml
git commit -m "ci: gate affected design-system stories"
```

### Task 4: Verify failure propagation and regression safety

**Files:**
- Temporarily modify and restore: `libs/ui/design-system/.storybook/test-runner.ts`

- [ ] **Step 1: Establish the successful baseline**

Run:

```bash
npx nx run design-system:test-storybook --skip-nx-cache
```

Expected: exit code 0 after all current story checks pass. If current stories fail, preserve the nonzero behavior and report each pre-existing failure before expanding scope.

- [ ] **Step 2: Prove runner failures reach Nx**

Temporarily add this as the first statement in `postVisit`:

```typescript
throw new Error('intentional Storybook gate verification failure');
```

Run:

```bash
npx nx run design-system:test-storybook --skip-nx-cache
```

Expected: FAIL with `intentional Storybook gate verification failure` and a nonzero exit code.

- [ ] **Step 3: Restore the runner and verify cleanup**

Remove only the temporary throw, then run:

```bash
npx nx run design-system:test-storybook --skip-nx-cache
```

Expected: the baseline result is restored and port 6007 is released.

- [ ] **Step 4: Run unit-test regression coverage**

Run:

```bash
npx nx test design-system --coverage=false
```

Expected: 27 test files and 272 tests pass, unless latest `main` has intentionally changed the counts.

- [ ] **Step 5: Run final repository checks**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors and only intentional implementation changes, if any remain uncommitted.
