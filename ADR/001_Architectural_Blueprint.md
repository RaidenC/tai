# TAI Portal: Architectural Blueprint and Implementation Strategy

## 1. Executive Summary and Strategic Architectural Vision
The "TAI Portal" Proof of Concept (POC) represents a pivotal moment in enterprise application engineering, marking a decisive shift away from traditional, reflection-heavy runtime environments toward a hyper-optimized, ahead-of-time compiled, and reactivity-driven ecosystem. As we initialize this greenfield initiative, the mandate is not merely to deliver a functional application but to establish a reference architecture that embodies the bleeding edge of the .NET 10 and Angular 21 ecosystems. This report serves as the foundational documentation and implementation guide for the TAI Portal Monorepo, detailing the scaffolding strategy, domain modeling decisions, and the governance structures required to maintain strict Clean Architecture compliance at scale.

The selection of our technology stack—.NET 10 (Standard JIT) and Angular 21 with Zone.js—is a strategic response to the need for maximum compatibility, developer velocity, and ecosystem stability. By leveraging the mature Just-In-Time (JIT) compilation on the server and the standard `zone.js` change detection on the client, TAI Portal ensures seamless integration with existing libraries and a familiar, high-speed development loop.

### 1.1 The Convergence of Performance and Strictness
The architectural philosophy governing this POC is "Performance by Default, Correctness by Design." This is achieved through two primary mechanisms:

*   **Strict Clean Architecture:** By enforcing rigid boundaries between the Domain, Application, Infrastructure, and Presentation layers, we ensure that the core business logic remains isolated from the volatility of external frameworks and UI concerns.
*   **Compiler-Driven Governance:** Leveraging the latest advancements in C# 14 and TypeScript 6.x, we shift validation and correctness checks from runtime to compile-time.

### 1.2 Operational Goals of the Monorepo
The decision to utilize Nx as the build system orchestration tool is driven by the need for a unified "mental model" of the codebase. In a polyglot environment where a C# backend and a TypeScript frontend must evolve in lockstep, Nx provides the dependency graph analysis required to understand the ripple effects of a change in the Core Domain. The "Portal" metaphor extends to our developer experience (DX); the workspace is designed to automate dependency management, testing, and deployment pipeline generation based on the affected areas of the graph.

This report is structured to guide the engineering team through the initialization of this sophisticated environment, providing the exact commands, configuration files, and domain logic patterns necessary to realize the TAI Portal vision.

## 2. Monorepo Ecosystem and Workspace Scaffolding
The foundation of the TAI Portal project is the Nx Monorepo. Unlike traditional solution-based structures in .NET or multi-repo approaches in frontend development, the Nx workspace treats the entire system as a single, interconnected graph. This allows for atomic commits that span the full stack—updating a Domain Entity in C# and the corresponding TypeScript interface in Angular simultaneously—thereby eliminating version skew and integration friction.

### 2.1 The Polyglot Integration Challenge
Integrating .NET into an ecosystem historically dominated by JavaScript tools requires a nuanced approach. The `@nx-dotnet/core` plugin serves as the bridge, allowing the Nx CLI to invoke the .NET CLI while capturing inputs and outputs for its computation caching engine. This integration ensures that running `nx build portal-api` utilizes the same caching artifacts and distributed task execution protocols as `nx build portal-web`.

The initialization of the workspace involves a specific sequence of operations to ensure both the Angular 21 presets and the .NET 10 toolchain are correctly configured without conflict. The primary objective is to create an "Integrated" workspace where libraries are shared constructs rather than isolated islands.

### 2.2 Task 1: Nx Workspace Configuration Command
To initialize the TAI Portal workspace with the requisite constraints (Angular 21, Zone.js, .NET 10), we execute a consolidated generation command. This command bypasses the standard interactive prompts to enforce our specific architectural standards programmatically.

The following comprehensive command sequence scaffolds the workspace, installs the necessary plugins, and generates the initial applications.

#### 2.2.1 Workspace Creation and Frontend Scaffolding
First, we establish the workspace using the Angular preset. This sets the default collection to `@nx/angular`, configures the base TypeScript settings, and prepares the linter configurations. Crucially, we explicitly disable `zone.js` support at the workspace level, a requirement for Angular 21's new reactivity model.

```bash
# Initialize the Nx Workspace with Angular 21 preset
npx create-nx-workspace@latest tai-portal \
  --preset=angular \
  --appName=portal-web \
  --style=scss \
  --bundler=esbuild \
  --e2eTestRunner=playwright \
  --ssr=false \
  --workspaceType=integrated \
  --nxCloud=skip \
  --packageManager=npm
```

**Analysis of Configuration Flags:**
*   `--zoneless=true`: This is the critical directive for Angular 21. It instructs the generator to omit `zone.js` from the polyfills array in `angular.json` and to bootstrap the application using `provideExperimentalZonelessChangeDetection()`. This aligns with our performance goals, removing the overhead of monkey-patching browser APIs.
*   `--bundler=esbuild`: We select esbuild over Webpack for its superior build performance, essential for maintaining fast feedback loops in a large monorepo.
*   `--workspaceType=integrated`: This creates a `libs/` directory structure intended for shared code, contrasting with "standalone" or "package-based" setups. This is vital for Clean Architecture, where `Core.Domain` and `Shared.UI` must be distinct, reusable libraries.

#### 2.2.2 Backend Scaffolding (.NET 10 API)
Once the workspace foundation is laid, we inject the .NET capabilities. We navigate into the workspace and utilize the `@nx-dotnet/core` plugin to generate the API project.

```bash
# Navigate into the workspace
cd tai-portal

# Install the .NET plugin for Nx
npm install --save-dev @nx-dotnet/core

# Initialize the plugin (infers usage from .sln files)
npx nx g @nx-dotnet/core:init

# Generate the .NET 10 Web API
npx nx g @nx-dotnet/core:app portal-api \
  --directory=apps/portal-api \
  --language="C#" \
  --template="webapi" \
  --testTemplate="nunit" \
  --solutionFile="tai-portal.sln" \
  --tags="type:api,scope:portal"
```

**Architectural Note on NativeAOT:**
While the command generates a standard Web API project, the requirement for .NET 10 NativeAOT necessitates a post-generation modification to the `.csproj` file. The command line generators for .NET often default to JIT configurations. To fully satisfy the NativeAOT constraint, the `PublishAot` property must be manually enforced in the generated project file, which we will address in the Backend Architecture section.

### 2.3 Directory Structure and Boundary Enforcement
The resulting structure provides physical separation that mirrors our logical architectural layers.

| Directory | Architectural Role | Technology |
| :--- | :--- | :--- |
| `apps/portal-web` | Presentation Layer (Frontend) | Angular 21 |
| `apps/portal-api` | Presentation Layer (Backend) | .NET 10 (ASP.NET Core) |
| `libs/core/domain` | Domain Layer | .NET Class Library (C# 14) |
| `libs/core/application` | Application Layer | .NET Class Library |
| `libs/core/infrastructure` | Infrastructure Layer | .NET Class Library |
| `libs/ui/design-system` | Shared UI | Angular Library |
| `libs/features/*` | Vertical Features | Angular Libraries |

This structure facilitates the enforcement of strict module boundaries via `nx enforce-module-boundaries` lint rules, ensuring that the Presentation layer can never import the Infrastructure layer directly, nor can the Domain layer import anything external.

## 3. Frontend Architecture: Angular 21, Hybrid Reactivity, and Signal-Driven Design
The "TAI Portal" frontend leverages the modern capabilities of Angular 21. While the framework now supports a fully Zoneless architecture, we have made a strategic decision to retain `zone.js` to ensure maximum compatibility with the existing ecosystem, particularly development tools like Storybook. However, we adopt a "Signal-First" development methodology, preparing the codebase for a future seamless transition to Zoneless.

### 3.1 Hybrid Reactivity Model
We utilize standard Zone-based change detection with event coalescing enabled. This provides the reliability of automatic change detection while we adopt the granular reactivity primitives of Signals.

*   **Zone.js Stability:** We include `zone.js` to ensure that third-party libraries and dev tools (Storybook) function without experimental configuration overhead.
*   **Signal-Driven State:** Despite using Zone.js, all component state and inputs will use Angular Signals (`input()`, `signal()`, `computed()`). This ensures that our components are "Zoneless-Ready".
*   **Event Coalescing:** We configure `provideZoneChangeDetection({ eventCoalescing: true })` to minimize change detection cycles, approximating the performance benefits of the new scheduler.

This architecture necessitates a strict adherence to the "Smart/Dumb" component pattern. "Smart" components (Containers) in `libs/features` interface with services and expose Observables converted to Signals. "Dumb" components (Presentational) in `libs/ui` accept `Input()` signals and emit `Output()` events, remaining purely stateless and reactive.

### 3.2 Task 2: Storybook Configuration
A critical component of our Clean Architecture is the isolation of UI components from business logic. Storybook provides this sandbox. Since we have opted to retain `zone.js` for the main application to resolve compatibility issues, the Storybook configuration becomes straightforward. We utilize the standard `@storybook/angular` builder.

The user request specifies providing the content for `.storybook/main.ts`.

#### 3.2.1 Content: .storybook/main.ts
This configuration file sets up the Storybook instance to use the standard Angular framework.

```typescript
import type { StorybookConfig } from '@storybook/angular';

/**
 * Storybook Main Configuration for TAI Portal
 * Context: Angular 21
 * 
 * This configuration leverages the standard Storybook Angular integration.
 */
const config: StorybookConfig = {
  stories: [
    '../src/**/*.mdx',
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    '../../../libs/ui/**/*.mdx',        // Include shared UI library stories
    '../../../libs/ui/**/*.stories.@(js|jsx|mjs|ts|tsx)'
  ],
  addons: [],
  framework: {
    name: '@storybook/angular',
    options: {},
  },
  staticDirs: ['../public'],
  docs: {
    autodocs: 'tag',
  },
};

export default config;
```

#### 3.2.2 The Critical Integration Link: project.json
We configure the project to use the standard Storybook executor.

```json
// Reference configuration for apps/portal-web/project.json
"targets": {
  "storybook": {
    "executor": "@storybook/angular:start-storybook",
    "options": {
      "port": 6006,
      "configDir": "apps/portal-web/.storybook",
      "tsConfig": "apps/portal-web/tsconfig.app.json"
    }
  }
}
```

By pairing the `main.ts` framework definition with this executor option, we ensure that Storybook bootstraps components using `bootstrapApplication` with the zoneless provider, mirroring the production environment.

## 4. Backend Architecture: .NET 10 and NativeAOT
The backend of TAI Portal leverages .NET 10, utilizing NativeAOT (Ahead-of-Time compilation) to compile the application directly to native machine code. This is a radical departure from the traditional Intermediate Language (IL) + JIT model.

### 4.1 The NativeAOT Paradigm
NativeAOT performs global program analysis during the build process. It walks the dependency graph, identifies used code, and trims everything else. This results in:
*   **Zero JIT Overhead:** The application starts executing user code immediately upon process launch.
*   **Reduced Footprint:** By trimming unused framework features, the deployment artifact is significantly smaller (often <20MB for a full API).
*   **Enhanced Security:** The absence of a JIT compiler reduces the surface area for certain classes of code-injection attacks.

### 4.2 The Identity Compatibility Challenge
The user requirement specifies inheriting from `IdentityUser`. Historically, ASP.NET Core Identity was incompatible with NativeAOT because it relied heavily on reflection to inspect entity types, discover generic parameters, and map database columns dynamically.

In .NET 10, this barrier is removed through the widespread adoption of Source Generators. Instead of inspecting types at runtime, the compiler generates the necessary glue code during the build.
*   **Request Delegate Generator (RDG):** Replaces reflection-based Minimal API mapping with statically generated route handlers.
*   **Configuration Binder Generator:** Generates code to bind `appsettings.json` to strongly typed options without reflection.
*   **EF Core 10 Precompiled Queries:** Generates SQL at build time, removing the runtime overhead of the query pipeline and enabling AOT compatibility.

To support `IdentityUser` in this context, we must ensure our DbContext and Entity configurations are explicit and avoid dynamic navigation property discovery that the trimmer cannot see.

## 5. Domain Modeling: C# 14 and Strict Entities
The Domain Layer is the heart of Clean Architecture. It must be free of dependencies and pure in its logic. We leverage C# 14 to express these concepts more concisely and robustly than previous versions allowed.

### 5.1 The field Keyword in C# 14
C# 14 introduces the `field` keyword, a "contextual keyword" available within property accessors. This feature solves a long-standing verbosity issue in C#. Before C# 14, if you wanted to add validation logic to a setter (e.g., ensuring a string isn't null), you had to manually declare a private backing field (`_name`). This broke the elegance of auto-implemented properties.

With `field`, we can access the compiler-synthesized backing field directly. This is particularly powerful for init-only properties in Domain Entities, where we want to enforce invariants during object creation (immutability) without the visual noise of backing fields.

### 5.2 Task 3: ApplicationUser Implementation with C# 14
We are tasked with implementing `ApplicationUser` inheriting from `IdentityUser` with a `TenantId` that is init-only and uses the `field` keyword. Furthermore, strictly adhering to Clean Architecture implies `TenantId` should not be a primitive Guid, but a strongly-typed Value Object to prevent "Primitive Obsession".

#### 5.2.1 The Value Object: TenantId
We define `TenantId` as a `readonly record struct`. This ensures value equality (two IDs with the same GUID are equal), immutability, and zero heap allocation overhead, which is critical for high-throughput NativeAOT scenarios.

```csharp
using System;

namespace Tai.Portal.Core.Domain.ValueObjects;

/// <summary>
/// A strongly-typed, immutable identifier for a Tenant.
/// Implemented as a readonly record struct to ensure value semantics and 
/// stack allocation efficiency in the NativeAOT environment.
/// </summary>
public readonly record struct TenantId
{
    // The underlying primitive value.
    public Guid Value { get; }

    // Primary constructor enforcing that the ID cannot be empty.
    public TenantId(Guid value)
    {
        if (value == Guid.Empty)
        {
            throw new ArgumentException("TenantId cannot be an empty GUID.", nameof(value));
        }
        Value = value;
    }

    // Explicit conversion avoids accidental assignment of raw Guids, 
    // enforcing type safety in the Domain layer.
    public static explicit operator TenantId(Guid value) => new(value);
    public static implicit operator Guid(TenantId id) => id.Value;
    
    public override string ToString() => Value.ToString();
}
```

#### 5.2.2 The Entity: ApplicationUser
Here is the C# 14 implementation. Note the use of the `field` keyword in the `init` accessor. This allows us to validate the `TenantId` assignment during object initialization while keeping the syntax clean and declarative.

```csharp
using System;
using Microsoft.AspNetCore.Identity;
using Tai.Portal.Core.Domain.ValueObjects;

namespace Tai.Portal.Core.Domain.Entities;

/// <summary>
/// Represents a user within the multi-tenant TAI Portal system.
/// Inherits from IdentityUser to leverage .NET Core Identity infrastructure
/// while extending it with domain-specific concerns.
/// </summary>
public class ApplicationUser : IdentityUser
{
    /// <summary>
    /// The unique identifier of the tenant this user belongs to.
    /// 
    /// FEATURES:
    /// 1. Init-only: Ensures immutability after creation.
    /// 2. C# 14 'field' keyword: Allows validation logic without a manual backing field.
    /// 3. Strict Invariant: Ensures a user is never created without a valid TenantId.
    /// </summary>
    public TenantId TenantId
    {
        get;
        // C# 14 Syntax: 'field' refers to the compiler-synthesized backing store.
        init => field = (value.Value == Guid.Empty) 
          ? throw new ArgumentException("A valid TenantId is required.", nameof(value)) 
            : value;
    }

    /// <summary>
    /// An example of using the field keyword for data sanitization on a standard property.
    /// </summary>
    public override string? Email
    {
        get;
        // C# 14: Direct access to backing field allows concise normalization logic.
        set => field = value?.Trim().ToLowerInvariant();
    }

    // NativeAOT & EF Core Requirement:
    // EF Core requires a parameterless constructor for materialization.
    // We keep it protected to prevent invalid domain state instantiation by consumer code.
    protected ApplicationUser() { }

    /// <summary>
    /// Domain Constructor ensuring all required invariants are met.
    /// </summary>
    public ApplicationUser(string userName, TenantId tenantId) : base(userName)
    {
        // The init accessor logic will run when we assign the property here.
        TenantId = tenantId;
    }
}
```

**Implications for NativeAOT:**
To make this entity compatible with NativeAOT serialization and EF Core 10, we must register it in a `JsonSerializable` context (if exposed via API) and configure a `ValueConverter` in the DbContext to map `TenantId` to `Guid` in the database. The record struct definition is generally AOT-safe, but the `IdentityUser` inheritance requires that the `Microsoft.AspNetCore.Identity.EntityFrameworkCore` package version matches the .NET 10 preview to utilize the new source-generated stores.

## 6. Governance and Structure: The GEMINI Standard
In a strictly layered Monorepo, the greatest risk is architectural drift—developers bypassing layers for convenience (e.g., a Controller accessing the Database directly). To mitigate this, we establish a definitive map of the system: GEMINI (Global Enterprise Monorepo Index & Navigation Interface).

This document serves two purposes:
1.  **Human Navigation:** A readme for developers to understand where code belongs.
2.  **Machine Governance:** The definitions here inform the `nx enforce-module-boundaries` rules in eslint, making architectural violations build failures.

### 6.1 Task 4: GEMINI.md Content
The following markdown content maps the specific requirements of the TAI Portal POC to the physical directory structure.

```markdown
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
```

## 7. Operational Excellence and Future Proofing
The architecture defined above is designed for longevity, but it introduces specific operational complexities that must be managed.

### 7.1 Testing in a NativeAOT World
Standard .NET mocking libraries (Moq, NSubstitute) rely heavily on dynamic proxy generation (Reflection.Emit), which is incompatible with NativeAOT.

**Strategy:** We must embrace Generate-based mocks or manual fakes. .NET 10 introduces experimental support for source-generated mocks, but for the POC, we recommend writing manual fakes for Domain Interfaces (`FakeUserRepository : IUserRepository`). This aligns with Clean Architecture, as tests run against the Application layer using fakes are faster and more robust than reflection-heavy unit tests.

### 7.2 CI/CD Pipeline Considerations
Building NativeAOT applications is computationally intensive. It is not a simple I/O bound copy operation; it involves compiling C# to IL, and then IL to native machine code (OBJ files), followed by a native linker step.

*   **Implication:** CI pipelines will be slower per build than JIT builds.
*   **Mitigation:** This highlights the importance of Nx Affected. By analyzing the dependency graph, we only trigger the expensive NativeAOT build when the `portal-api` or its dependencies (`core-domain`, `core-app`) have changed. If only the frontend changes, the backend build is skipped entirely.

### 7.3 Conclusion
The TAI Portal POC is an ambitious synthesis of the most advanced capabilities in the modern web stack. By scaffolding with Nx, we secure a manageable monorepo structure. By adopting Angular 21 Zoneless, we future-proof the frontend against performance decay. By implementing the Core Domain with C# 14 and targeting .NET 10 NativeAOT, we achieve a backend architecture that is rigorous, type-safe, and incredibly performant. The code and configurations provided in this report constitute the executable specification for immediate implementation.