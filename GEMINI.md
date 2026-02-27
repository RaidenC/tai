# GEMINI: Global Enterprise Monorepo Index & Navigation Interface

## 1. Architectural Overview
*   **Project:** TAI Portal POC
*   **Architecture:** Strict Clean Architecture
*   **Enforcement:** Automated via Nx Linting & NativeAOT Compilation constraints.

The system is composed of concentric layers. Dependencies flow inwards. The inner layers (Domain) have no knowledge of the outer layers (Infrastructure/Presentation).

## 2. Directory Map & Responsibilities

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
*   **Technology:** .NET 10 Class Library
*   **Dependencies:** Domain
*   **Contents:**
    *   `UseCases/`: CQRS Handlers (Commands/Queries).
    *   `DTOs/`: Data Transfer Objects for API contracts.
    *   `Services/`: Orchestration logic.

#### 🏗️ Infrastructure (libs/core/infrastructure)
*   **Path:** `libs/core/infrastructure`
*   **Technology:** .NET 10 Class Library
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

## 3. Strict Boundary Rules
The following dependency rules are enforced by the build system. Violations will prevent CI/CD success.
*   **Domain Isolation:** `libs/core/domain` cannot import anything.
*   **Infrastructure Abstraction:** `libs/core/application` depends on domain, NEVER infrastructure.
*   **UI Separation:** `libs/ui/design-system` cannot import `libs/features`.
*   **Backend Agnosticism:** `libs/core/*` cannot import `apps/portal-api`.

## 4. Operational Commands
*   **Start Web:** `nx serve portal-web`
*   **Start API:** `nx serve portal-api`
*   **Build AOT:** `nx build portal-api --configuration=production` (Triggers NativeAOT)
*   **Storybook:** `nx storybook portal-web`

Maintained by TAI Architecture Team - Generated Feb 2026
