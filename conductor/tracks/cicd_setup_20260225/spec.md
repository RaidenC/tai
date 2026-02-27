# Specification: CI/CD Setup

## Overview
Implement a "Proper" CI/CD pipeline using GitHub Actions to ensure code quality, automated testing, and reliable deployments for the TAI Portal monorepo.

## Core Requirements
1.  **Orchestration:** Use **Nx Affected** to efficiently run builds, lints, and tests only on projects impacted by a PR or commit.
2.  **Quality Gates:**
    -   **Linting:** Enforce project-wide linting rules.
    -   **Unit Testing:** Run xUnit (.NET) and Vitest (Angular) suites.
    -   **Integration Testing:** Execute API integration tests (using PostgreSql Testcontainers).
3.  **Dockerization:** Build Docker images for `portal-api` and `portal-gateway` on successful builds of the `main` branch.
4.  **Security:**
    -   Scan for secrets in the codebase.
    -   Verify the shared Gateway Secret is injected via GitHub Secrets.

## Technical Details
-   **CI Platform:** GitHub Actions.
-   **Environment:** Ubuntu Runners.
-   **Caching:** Leverage GitHub Actions caching for `node_modules` and NuGet packages to speed up builds.
-   **Artifacts:** Export test results and coverage reports.

## Success Criteria
- [ ] PRs automatically trigger `nx affected` for lint, test, and build.
- [ ] Merges to `main` trigger a production Docker build.
- [ ] The pipeline fails if test coverage drops below our 90% threshold.
