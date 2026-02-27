### Day 1: Project Scaffolding & Secure Monorepo Initialization
**Strategic Context:**
The foundation of a distributed system dictates its long-term maintainability. We will use an Nx Monorepo structure. Nx provides the sophisticated dependency graph analysis required to manage both the .NET backend and Angular frontend in a single repository, ensuring that shared contracts (like API DTOs) remain synchronized.

**Feature 1.1: Nx Workspace with Strict Boundaries**
*   **Description:** Initialize the workspace with strict module boundaries. The architecture will separate `libs/identity/ui` (Dumb Components), `libs/identity/feature` (Smart Components/Pages), `libs/identity/domain` (Business Logic), and `libs/identity/data-access` (API Clients).
*   **Technical Detail:** The Angular application will use standard configuration with SCSS and ESLint. The .NET API will use standard configuration.
*   **Acceptance Criteria:**
    *   `nx serve portal-portal` launches the Angular app with `zone.js` enabled.
    *   `nx serve identity-api` launches the .NET 10 Web API.
    *   The .NET project file (`.csproj`) is configured for standard execution.
    *   A generic `Refining_Prompts.md` file is created in the root to guide future AI interactions.

**Feature 1.2: Storybook 8+ Integration**
*   **Description:** Configure the component development environment. This requires standard configuration for Angular's build system.
*   **Technical Detail:** We will use the standard `@storybook/angular` builder. The accessibility addon must be active by default.
*   **Acceptance Criteria:**
    *   Storybook runs on port 6006.
    *   A "Hello World" component using standard `@Input()` decorators renders correctly in Storybook.
    *   The "Accessibility" panel in Storybook is visible and shows zero violations for the default component.

**Feature 1.3: C# 14 Domain Modeling (Identity Kernel)**
*   **Description:** Define the core entities that represent the identity domain. This is not just a database schema; it is the behavioral model of the user.
*   **Technical Detail:** We will use standard C# properties to implement concise, encapsulated properties. The `ApplicationUser` entity will inherit from `IdentityUser` but will be extended with multi-tenancy support (`TenantId`).
*   **Acceptance Criteria:**
    *   `ApplicationUser` class is defined with a strongly-typed `TenantId` (Value Object).
    *   `Tenant` entity is defined with configuration properties for SSO settings (e.g., `EnforceMfa`).
    *   EF Core 10 `DbContext` is configured with these entities.

> **Gemini Deep Search Prompt (Day 1):**
>
> **Persona:** Principal Software Architect specializing in .NET 10 and Angular 21.
> **Context:** You are initializing a greenfield "TAI Portal" POC. The system requires strict Clean Architecture constraints to support a distributed financial platform.
> **Task:** Scaffolding the Nx Monorepo and Core Domain.
> **Constraints:**
> *   **Angular:** Use standard Angular with Zone.js enabled for stability.
*   **Backend:** Use .NET 10 (Standard JIT). Focus on compatibility and build speed.
*   **Language:** Use standard C# syntax for domain entities.
> *   **Architecture:** Strictly separate Domain, Infrastructure, and API layers.
>
> **Step-by-Step Instructions:**
> 1.  Generate an `nx` workspace configuration command that creates a .NET 10 API project and a standard Angular application.
> 2.  Provide the content for `.storybook/main.ts` using the standard `@storybook/angular` builder.
*   3.  Draft the C# code for the `ApplicationUser` entity. It must inherit from `IdentityUser`. Include a `TenantId` property. Ensure `TenantId` cannot be changed after initialization (init-only setter logic).
> 4.  Create a `GEMINI.md` file structure that maps these directories for future context retrieval.