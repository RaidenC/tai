# GEMINI: Global Enterprise Monorepo Index & Navigation Interface

# Master Orchestrator Rules: Enterprise .NET 10 & Angular Workspace
You are the Orchestrator Agent. Your job is to understand requirements, decompose them into plans using the Conductor extension, and delegate execution to specialized sub-agents.

## 1. Workspace Architecture

- **Frontend Workspace:** Multi-app Angular setup (`apps/portal-web`, `apps/identity-ui`) and shared design system (`libs/ui/design-system`).
- **Backend Workspace:** .NET 10 Clean Architecture distributed across `libs/core/domain`, `libs/core/application`, `libs/core/infrastructure`, and hosted in `apps/portal-api` and `apps/portal-gateway`.
- **Testing:** `apps/*-e2e` for Playwright, `apps/*.integration-tests` for backend API tests, and `libs/core/*.tests` for unit tests.

## 2. Orchestration Protocol

1. Use `/conductor:newTrack` to plan new features before writing any code.
2. Do not write implementation code directly if it spans multiple domains.
3. For UI tasks, instruct the user to switch to the frontend worktree and use `/frontend`.
4. For Backend tasks, instruct the user to switch to the backend worktree and use `/backend`.
5. For Database migrations, use `/db-optimizer` and await manual execution.
6. For Code Review, use `/architect-review` to check against our guidelines in the `conductor/` folder.

---

## 3. Architectural Overview
*   **Project:** TAI Portal POC
*   **Architecture:** Strict Clean Architecture
*   **Enforcement:** Automated via Nx Linting & NativeAOT Compilation constraints.

The system is composed of concentric layers. Dependencies flow inwards. The inner layers (Domain) have no knowledge of the outer layers (Infrastructure/Presentation).

## 4. Directory Map & Responsibilities

### 📂 Apps (Entry Points)
The executable deployables. These contain no business logic. Their sole responsibility is bootstrapping, dependency injection configuration, and hosting.

| Path | Type | Framework | Responsibility |
| :--- | :--- | :--- | :--- |
| `apps/portal-web` | Presentation | Angular 21 | Single Page Application. Hosts the Shell and lazy-loads features. Zoneless configuration. |
| `apps/portal-api` | Presentation | .NET 10 | REST API. Hosts Controllers/Minimal API Endpoints. NativeAOT build target. |

### 📂 Libs (The Codebase)
The reusable building blocks, separated by architectural concern.

#### 🏛️ Core Domain (libs/core/domain)
*   **Path:** `libs/core/domain`
*   **Technology:** .NET 10 Class Library (C# 14)
*   **Dependencies:** None (Pure C#)
*   **Contents:**
    *   `Entities/`: Rich domain models (`ApplicationUser`) with behavior.
    *   `ValueObjects/`: Immutable primitives (`TenantId` record structs).
    *   `Events/`: Domain Events (`UserRegisteredEvent`).
    *   `Interfaces/`: Repository Contracts (`IUserRepository`).
*   **Rules:** No references to EF Core, HttpContext, or Angular.

#### 🧠 Application Logic (libs/core/application)
*   **Path:** `libs/core/application`
*   **Technology:** .NET 10 Class Library (C# 14)
*   **Dependencies:** Domain
*   **Contents:**
    *   `UseCases/`: CQRS Handlers (Commands/Queries).
    *   `DTOs/`: Data Transfer Objects for API contracts.
    *   `Services/`: Orchestration logic.

#### 🏗️ Infrastructure (libs/core/infrastructure)
*   **Path:** `libs/core/infrastructure`
*   **Technology:** .NET 10 Class Library (C# 14)
*   **Dependencies:** Domain, Application
*   **Contents:**
    *   `Persistence/`: EF Core 10 DbContext, Migrations, Source Generators.
    *   `Identity/`: AspNetCore.Identity concrete implementations.
    *   `Adapters/`: Email, Storage, Service Bus implementations.

#### 🎨 Web UI System (libs/ui/design-system)
*   **Path:** `libs/ui/design-system`
*   **Technology:** Angular 21 Library
*   **Dependencies:** None
*   **Contents:**
    *   **Dumb Components:** Buttons, Cards, Inputs. Pure `Input()`/`Output()`.
    *   **Storybook:** `.stories.ts` files for isolated development.
    *   **Styles:** Global SCSS/Tailwind config.

#### 🚀 Web Features (libs/features/*)
*   **Path:** `libs/features/[feature-name]`
*   **Technology:** Angular 21 Library
*   **Dependencies:** Web UI, Application Client (Generated API Client)
*   **Contents:**
    *   **Smart Components:** Route handlers, Signal Stores, API integration.

## 5. Strict Boundary Rules
The following dependency rules are enforced by the build system. Violations will prevent CI/CD success.
*   **Domain Isolation:** `libs/core/domain` cannot import anything.
*   **Infrastructure Abstraction:** `libs/core/application` depends on domain, NEVER infrastructure.
*   **UI Separation:** `libs/ui/design-system` cannot import `libs/features`.
*   **Backend Agnosticism:** `libs/core/*` cannot import `apps/portal-api`.

## 6. Operational Commands
*   **Start Web:** `nx serve portal-web`
*   **Start API:** `nx serve portal-api`
*   **Build AOT:** `nx build portal-api --configuration=production` (Triggers NativeAOT)
*   **Storybook:** `nx storybook portal-web`

Maintained by TAI Architecture Team - Generated Feb 2026
