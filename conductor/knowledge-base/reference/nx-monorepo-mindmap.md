---
markmap:
  initialExpandLevel: 4
  colorFreezeLevel: 3
  spacingVertical: 10
---
# 1. Nx Monorepo & Workspace Architecture

## **1.1. Monorepo Fundamentals**
1. Why Monorepos Exist
   - Single repo, multiple projects, atomic cross-project commits
   - Solves version drift: shared code changes propagate instantly
   - Requires disciplined module boundaries to avoid "everything affects everything"
2. Nx vs Turborepo vs Lerna
   - Nx: full build system with generators, boundaries, multi-language plugins
   - Turborepo: lightweight task runner, JS/TS only, minimal config
   - Lerna: package publishing, now Nx-powered under the hood
3. Workspace Layout (Apps & Libs)
   - apps/: deployable (portal-web, portal-api, identity-ui, portal-gateway)
   - libs/: shared code (core-domain, core-application, core-infrastructure, design-system)
   - Apps are thin composition roots; libs contain real logic
4. Project Graph
   - Auto-detected from TS imports, tsconfig paths, .csproj ProjectReferences
   - Foundation for affected commands and task ordering
   - Visualize with `npx nx graph`
5. Task Pipeline & dependsOn
   - `^build`: build upstream dependencies first (topological order)
   - Project-level: build-tailwind must run before portal-web build
   - Missing dependencies cause flaky CI on clean environments

## **1.2. Nx Build System**
1. Computation Caching
   - Stores task outputs (files + terminal); replays on identical inputs
   - tai-portal: build, test, lint all cached via targetDefaults
   - Cache key: source hash + dependency hash + runtime + config
2. Affected Commands
   - `nx affected -t test`: only test projects changed by the PR
   - Walks project graph from changed files to downstream dependents
   - tai-portal CI: lint → build → test all use affected
3. Nx Cloud & Remote Caching
   - Shares cache across developers and CI agents
   - tai-portal: NX_CLOUD_ACCESS_TOKEN in GitHub Actions secrets
   - Falls back to local computation if unreachable
4. Inputs & Named Inputs
   - Define which files contribute to cache key
   - `default` = project source files; `^default` = dependency files
   - ESLint target includes workspace eslint.config.mjs as input

## **1.3. Multi-Stack Monorepo (.NET + Angular)**
1. @nx-dotnet/core Plugin
   - Brings .NET projects into Nx task graph
   - Reads .csproj ProjectReferences for dependency detection
   - Executors: @nx-dotnet/core:build, :serve, :test
2. TypeScript Path Aliases
   - `@tai/ui-design-system` maps to `libs/ui/design-system/src/index.ts`
   - Enables clean imports and Nx graph inference
   - Barrel export (index.ts) controls library's public API
3. Shared Design System Library
   - 12+ Angular components shared by portal-web and identity-ui
   - Built with ng-packagr (@nx/angular:package)
   - Components: AppShell, Sidebar, DataTable, SecureInput, HasPrivilegeDirective
4. Storybook Integration
   - @nx/storybook/plugin for design-system and portal-web
   - Isolated component development on port 6006
   - Static build output for CI/deployment

## **1.4. Module Boundaries & Governance**
1. Tags & depConstraints
   - Two dimensions: scope (core, ui, portal) + type (domain, infrastructure, api)
   - tai-portal tags: portal-api [type:api, scope:portal], core-domain [type:domain, scope:core]
   - Tags without constraints are just decoration
2. enforce-module-boundaries Rule
   - ESLint rule: catches illegal imports at lint time
   - tai-portal: currently permissive (* → *)
   - Production: domain → nothing, application → domain, infrastructure → both
3. Layered Architecture Enforcement
   - .NET libs already follow Clean Architecture via ProjectReferences
   - Nx tags mirror the physical layer structure
   - Cross-cutting concerns need a `type:shared` escape hatch

## **1.5. CI/CD & DevOps**
1. Affected in CI
   - GitHub Actions: lint, build, test all use `nx affected`
   - E2E in separate job gated by needs: ci
   - Docker builds on main push only
2. nx-set-shas for PR Diffing
   - nrwl/nx-set-shas@v4 determines NX_BASE and NX_HEAD
   - Requires fetch-depth: 0 for full Git history
   - Handles squash merges and force pushes automatically
3. Docker Builds in a Monorepo
   - Build context = entire repo (shared libs outside app dir)
   - Multi-stage builds: SDK → restore → build → ASP.NET runtime
   - .dockerignore critical for performance
4. Git Worktrees
   - Three worktrees: backend-workspace, frontend-workspace, phase7-notification-panel
   - Each has independent node_modules and Nx cache
   - Enables parallel development on different branches

## **1.6. Generators & Automation**
1. Built-in Generators & Defaults
   - Angular apps: Playwright E2E + ESLint + SCSS + Vitest
   - Angular libs: ESLint + Vitest
   - Components: SCSS style default
2. Custom Workspace Generators
   - Codify team conventions into executable scaffolding
   - tai-portal: not yet implemented, uses standard generators
   - High ROI for large teams (10+ devs creating modules weekly)
3. Nx Release & Versioning
   - design-system: git-tag version resolver, Verdaccio local registry
   - preVersionCommand: builds all before versioning
   - Internal libs don't need release — direct tsconfig imports suffice
