# Implementation Plan: CI/CD Setup

## Phase 1: CI Pipeline Scaffolding

- [x] Task: Research and define the GitHub Actions workflow structure (`main.yml`).
- [x] Task: Configure Nx Cloud or local caching for GitHub Actions.
- [x] Task: Implement PostgreSQL Service Container in `main.yml` to support API integration tests.
- [x] Task: Implement "Build & Lint" job using `nx affected`.
- [x] Task: Implement "Test" job for .NET and Angular projects.
- [x] Task: Conductor - User Manual Verification 'Phase 1: CI Pipeline Scaffolding' (7a1b6c2)

## Phase 2: Dockerization & Environment Verification

- [x] Task: Create `Dockerfile` for `portal-api` (Standard JIT, No AOT). (7a1b6c2)
- [x] Task: Create `Dockerfile` for `portal-gateway`. (7a1b6c2)
- [x] Task: Implement "Docker Build" job in the CI pipeline. (7a1b6c2)
- [x] Task: Conductor - User Manual Verification 'Phase 2: Dockerization' (7a1b6c2)

## Phase 3: Final Integration & Cleanup

- [x] Task: Integrate Playwright E2E tests into the CI pipeline. (7a1b6c2)
- [x] Task: Add a "Security Scan" step (e.g., using Gitleaks or similar). (7a1b6c2)
- [x] Task: Implement 90% test coverage enforcement in the CI pipeline for both .NET and Angular projects. (fbea624)
- [x] Task: Conductor - User Manual Verification 'Phase 3: Final Integration' (7a1b6c2)
