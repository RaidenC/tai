# Borrower Portal API (Payment Protection) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `borrower-portal-api` (.NET 10 / ASP.NET Core) as the persistence backend for the borrower-portal frontend's claim-draft feature, using a new `Payment Protection` bounded context (Postgres schema `payment_protection`, `PaymentProtectionDbContext`) that mirrors portal-api's Clean Architecture + CQRS + MediatR conventions.

**Architecture:** Clean Architecture with three new lib projects — `libs/payment-protection/{domain,application,infrastructure}` — referencing existing `libs/core/*` for cross-cutting concerns (TenantInterceptor, IMessageBus, IAuditableEntity). Application layer uses MediatR commands/queries with FluentValidation pipeline. Infrastructure adapts an `IClaimDraftStore` port via EF Core + Npgsql. The HTTP surface (`apps/borrower-portal-api`) is thin: controller dispatches via `IMediator`. Real auth (OpenIddict) is deferred — for the POC, an `X-User-Id` header stub middleware fills `ICurrentUserService.UserId`.

**Tech Stack:** .NET 10, ASP.NET Core, EF Core 10 + Npgsql, MediatR 14, FluentValidation 12, xunit + FluentAssertions + Moq, Postgres 17 (existing `portal-db` instance, new `payment_protection` schema).

---

## File Structure

```
docker-compose.yml                                          ← Modify (no new service, comment-only)

libs/payment-protection/
  domain/
    Tai.PaymentProtection.Domain.csproj                     ← Create
    project.json                                            ← Create
    Entities/ClaimDraft.cs                                  ← Create

  application/
    Tai.PaymentProtection.Application.csproj                ← Create
    project.json                                            ← Create
    IApplicationAssemblyMarker.cs                           ← Create
    Interfaces/IClaimDraftStore.cs                          ← Create
    Events/ClaimDraftSavedEvent.cs                          ← Create
    UseCases/Drafts/SaveClaimDraftCommand.cs                ← Create (Command + Validator + Handler)
    UseCases/Drafts/GetClaimDraftQuery.cs                   ← Create (Query + Handler)
    UseCases/Drafts/DeleteClaimDraftCommand.cs              ← Create (Command + Handler)

  application.tests/
    Tai.PaymentProtection.Application.Tests.csproj          ← Create
    project.json                                            ← Create
    UseCases/Drafts/SaveClaimDraftCommandHandlerTests.cs    ← Create
    UseCases/Drafts/GetClaimDraftQueryHandlerTests.cs       ← Create
    UseCases/Drafts/DeleteClaimDraftCommandHandlerTests.cs  ← Create

  infrastructure/
    Tai.PaymentProtection.Infrastructure.csproj             ← Create
    project.json                                            ← Create
    Persistence/PaymentProtectionDbContext.cs               ← Create
    Persistence/Configurations/ClaimDraftConfiguration.cs   ← Create
    Persistence/EfClaimDraftStore.cs                        ← Create
    Persistence/Migrations/<timestamp>_InitialPaymentProtection.cs  ← Create (EF generated)
    Handlers/ClaimDraftSavedAuditHandler.cs                 ← Create

  infrastructure.tests/
    Tai.PaymentProtection.Infrastructure.Tests.csproj       ← Create
    project.json                                            ← Create
    Persistence/EfClaimDraftStoreTests.cs                   ← Create

apps/borrower-portal-api/
  borrower-portal-api.csproj                                ← Create
  project.json                                              ← Create
  Program.cs                                                ← Create
  appsettings.json                                          ← Create
  appsettings.Development.json                              ← Create
  Properties/launchSettings.json                            ← Create
  Middleware/XUserIdMiddleware.cs                           ← Create
  Controllers/DraftController.cs                            ← Create

apps/borrower-portal/src/app/
  app.config.ts                                             ← Modify (remove mockApiInterceptor)
  claim/services/claim-draft.service.ts                     ← Modify (point at real API base URL)
apps/borrower-portal/src/environments/environment.ts        ← Create (API base URL)
```

**Hard-stop checkpoints** (review before proceeding):
- **After Task 5:** Lib scaffolds compile, no logic yet — verify the project graph is healthy before adding behavior.
- **After Task 10:** All application-layer use cases pass unit tests against `Mock<IClaimDraftStore>` — verify CQRS shape before touching infrastructure.
- **After Task 14:** Migration applied to local Postgres, `EfClaimDraftStore` integration test passes — verify persistence works in isolation.
- **After Task 18:** Backend reachable via `curl` (PATCH/GET/DELETE `/api/claims/draft` with `X-User-Id` header) — verify backend works alone before cutting frontend over.
- **After Task 20:** Frontend completes a wizard step end-to-end against the real API — full smoke test before declaring done.

---

## Task 1: Add `payment_protection` schema bootstrap note to docker-compose

**Files:**
- Modify: `docker-compose.yml`

The `payment_protection` schema is created automatically by the EF migration (Task 13) — no docker-compose change is strictly required. We add a comment so future readers understand why two DbContexts share one Postgres instance.

- [ ] **Step 1: Add a clarifying comment to docker-compose.yml**

Edit `docker-compose.yml` so the `postgres` service comment block reads:

```yaml
services:
  postgres:
    image: postgres:17
    container_name: portal-db
    # Hosts two schemas: 'public' (PortalDbContext / portal-api) and
    # 'payment_protection' (PaymentProtectionDbContext / borrower-portal-api).
    # Each DbContext owns its own __EFMigrationsHistory table inside its schema.
    environment:
      POSTGRES_DB: portal
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - portal-data:/var/lib/postgresql/data

volumes:
  portal-data:
```

- [ ] **Step 2: Verify Postgres is reachable**

Run: `docker compose up -d postgres && docker compose exec postgres psql -U postgres -d portal -c "SELECT version();"`
Expected: PostgreSQL 17.x version string printed.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "docs(infra): document shared Postgres instance hosts payment_protection schema"
```

---

## Task 2: Scaffold `libs/payment-protection/domain` project

**Files:**
- Create: `libs/payment-protection/domain/Tai.PaymentProtection.Domain.csproj`
- Create: `libs/payment-protection/domain/project.json`

- [ ] **Step 1: Create the csproj**

Write `libs/payment-protection/domain/Tai.PaymentProtection.Domain.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <RootNamespace>Tai.PaymentProtection.Domain</RootNamespace>
  </PropertyGroup>

  <ItemGroup>
    <ProjectReference Include="../../core/domain/Tai.Portal.Core.Domain.csproj" />
  </ItemGroup>

</Project>
```

- [ ] **Step 2: Create the Nx project.json**

Write `libs/payment-protection/domain/project.json`:

```json
{
  "name": "payment-protection-domain",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/payment-protection/domain",
  "projectType": "library",
  "tags": ["type:lib", "scope:payment-protection", "layer:domain"],
  "targets": {
    "build": {
      "executor": "@nx-dotnet/core:build",
      "options": {
        "configuration": "Debug",
        "noDependencies": true
      },
      "configurations": {
        "production": { "configuration": "Release" }
      }
    }
  }
}
```

- [ ] **Step 3: Verify the project builds**

Run: `dotnet build libs/payment-protection/domain/Tai.PaymentProtection.Domain.csproj`
Expected: `Build succeeded.` with 0 errors, 0 warnings.

- [ ] **Step 4: Commit**

```bash
git add libs/payment-protection/domain/
git commit -m "feat(payment-protection): scaffold domain project"
```

---

## Task 3: Create `ClaimDraft` entity

**Files:**
- Create: `libs/payment-protection/domain/Entities/ClaimDraft.cs`

`ClaimDraft` is keyed by `UserId + ClaimId` (composite PK), holds an opaque encrypted blob, has TTL via `ExpiresAt`, and implements `IAuditableEntity` so portal-api's existing audit conventions apply. It does *not* implement `IMultiTenantEntity` — multi-tenancy is deferred until real auth lands.

- [ ] **Step 1: Write the entity**

Write `libs/payment-protection/domain/Entities/ClaimDraft.cs`:

```csharp
using System;
using Tai.Portal.Core.Domain.Interfaces;

namespace Tai.PaymentProtection.Domain.Entities;

/// <summary>
/// A borrower's in-progress claim form. Stored as an opaque encrypted byte[]
/// (the frontend encrypts before send / decrypts after fetch). The server treats
/// the payload as opaque — no business logic on contents.
///
/// Composite key: (UserId, ClaimId). One borrower may have multiple draft claims.
/// TTL via ExpiresAt — queries filter expired rows, no background cleanup for POC.
/// </summary>
public class ClaimDraft : IAuditableEntity {
  public string UserId { get; private set; } = string.Empty;
  public string ClaimId { get; private set; } = string.Empty;
  public byte[] EncryptedPayload { get; private set; } = Array.Empty<byte>();
  public DateTimeOffset ExpiresAt { get; private set; }

  public DateTimeOffset CreatedAt { get; set; }
  public string? CreatedBy { get; set; }
  public DateTimeOffset? LastModifiedAt { get; set; }
  public string? LastModifiedBy { get; set; }

  // EF Core parameterless constructor
  private ClaimDraft() { }

  public ClaimDraft(string userId, string claimId, byte[] encryptedPayload, DateTimeOffset expiresAt) {
    if (string.IsNullOrWhiteSpace(userId)) {
      throw new ArgumentException("UserId cannot be empty.", nameof(userId));
    }
    if (string.IsNullOrWhiteSpace(claimId)) {
      throw new ArgumentException("ClaimId cannot be empty.", nameof(claimId));
    }
    if (encryptedPayload == null || encryptedPayload.Length == 0) {
      throw new ArgumentException("Payload cannot be empty.", nameof(encryptedPayload));
    }

    UserId = userId;
    ClaimId = claimId;
    EncryptedPayload = encryptedPayload;
    ExpiresAt = expiresAt;
  }

  public void Update(byte[] encryptedPayload, DateTimeOffset expiresAt) {
    if (encryptedPayload == null || encryptedPayload.Length == 0) {
      throw new ArgumentException("Payload cannot be empty.", nameof(encryptedPayload));
    }
    EncryptedPayload = encryptedPayload;
    ExpiresAt = expiresAt;
  }

  public bool IsExpired(DateTimeOffset now) => now >= ExpiresAt;
}
```

- [ ] **Step 2: Verify it builds**

Run: `dotnet build libs/payment-protection/domain/Tai.PaymentProtection.Domain.csproj`
Expected: `Build succeeded.`

- [ ] **Step 3: Commit**

```bash
git add libs/payment-protection/domain/Entities/ClaimDraft.cs
git commit -m "feat(payment-protection): add ClaimDraft entity with composite key + TTL"
```

---

## Task 4: Scaffold `libs/payment-protection/application` project

**Files:**
- Create: `libs/payment-protection/application/Tai.PaymentProtection.Application.csproj`
- Create: `libs/payment-protection/application/project.json`
- Create: `libs/payment-protection/application/IApplicationAssemblyMarker.cs`

- [ ] **Step 1: Create the csproj**

Write `libs/payment-protection/application/Tai.PaymentProtection.Application.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <RootNamespace>Tai.PaymentProtection.Application</RootNamespace>
  </PropertyGroup>

  <ItemGroup>
    <ProjectReference Include="../domain/Tai.PaymentProtection.Domain.csproj" />
    <ProjectReference Include="../../core/application/Tai.Portal.Core.Application.csproj" />
  </ItemGroup>

  <ItemGroup>
    <PackageReference Include="FluentValidation" Version="12.1.1" />
    <PackageReference Include="MediatR" Version="14.1.0" />
  </ItemGroup>

</Project>
```

- [ ] **Step 2: Create the Nx project.json**

Write `libs/payment-protection/application/project.json`:

```json
{
  "name": "payment-protection-application",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/payment-protection/application",
  "projectType": "library",
  "tags": ["type:lib", "scope:payment-protection", "layer:application"],
  "targets": {
    "build": {
      "executor": "@nx-dotnet/core:build",
      "options": { "configuration": "Debug", "noDependencies": true },
      "configurations": { "production": { "configuration": "Release" } }
    }
  }
}
```

- [ ] **Step 3: Create the assembly marker**

Write `libs/payment-protection/application/IApplicationAssemblyMarker.cs`:

```csharp
namespace Tai.PaymentProtection.Application;

/// <summary>
/// Marker interface used by the host (borrower-portal-api/Program.cs) to scan
/// this assembly for MediatR handlers and FluentValidation validators.
/// Mirrors Tai.Portal.Core.Application.IApplicationAssemblyMarker.
/// </summary>
public interface IApplicationAssemblyMarker { }
```

- [ ] **Step 4: Verify the project builds**

Run: `dotnet build libs/payment-protection/application/Tai.PaymentProtection.Application.csproj`
Expected: `Build succeeded.`

- [ ] **Step 5: Commit**

```bash
git add libs/payment-protection/application/
git commit -m "feat(payment-protection): scaffold application project + assembly marker"
```

---

## Task 5: Create `IClaimDraftStore` port and `ClaimDraftSavedEvent` notification

**Files:**
- Create: `libs/payment-protection/application/Interfaces/IClaimDraftStore.cs`
- Create: `libs/payment-protection/application/Events/ClaimDraftSavedEvent.cs`

The port abstracts persistence so handlers stay testable with an in-memory fake. The notification lets cross-cutting handlers (audit logger now, outbox writer later) react to draft saves without modifying the command handler.

**🛑 Hard-stop checkpoint after this task:** review project graph (`dotnet build` of solution / Nx graph) before adding logic.

- [ ] **Step 1: Write the port**

Write `libs/payment-protection/application/Interfaces/IClaimDraftStore.cs`:

```csharp
using System;
using System.Threading;
using System.Threading.Tasks;
using Tai.PaymentProtection.Domain.Entities;

namespace Tai.PaymentProtection.Application.Interfaces;

/// <summary>
/// Persistence port for claim drafts. Implemented by EfClaimDraftStore
/// (Postgres / EF Core) in the infrastructure layer; an in-memory fake is
/// used in handler unit tests.
/// </summary>
public interface IClaimDraftStore {
  Task<ClaimDraft?> GetAsync(string userId, string claimId, CancellationToken cancellationToken = default);
  Task SaveAsync(ClaimDraft draft, CancellationToken cancellationToken = default);
  Task DeleteAsync(string userId, string claimId, CancellationToken cancellationToken = default);
}
```

- [ ] **Step 2: Write the notification**

Write `libs/payment-protection/application/Events/ClaimDraftSavedEvent.cs`:

```csharp
using System;
using MediatR;

namespace Tai.PaymentProtection.Application.Events;

/// <summary>
/// Raised after a claim draft is persisted. Used for cross-cutting fan-out:
/// audit logging today, outbox-to-RabbitMQ in the future.
/// </summary>
public record ClaimDraftSavedEvent(string UserId, string ClaimId, DateTimeOffset SavedAt) : INotification;
```

- [ ] **Step 3: Verify it builds**

Run: `dotnet build libs/payment-protection/application/Tai.PaymentProtection.Application.csproj`
Expected: `Build succeeded.`

- [ ] **Step 4: Commit**

```bash
git add libs/payment-protection/application/Interfaces/IClaimDraftStore.cs libs/payment-protection/application/Events/ClaimDraftSavedEvent.cs
git commit -m "feat(payment-protection): add IClaimDraftStore port and ClaimDraftSavedEvent"
```

---

## Task 6: Scaffold `libs/payment-protection/application.tests` project

**Files:**
- Create: `libs/payment-protection/application.tests/Tai.PaymentProtection.Application.Tests.csproj`
- Create: `libs/payment-protection/application.tests/project.json`

- [ ] **Step 1: Create the csproj**

Write `libs/payment-protection/application.tests/Tai.PaymentProtection.Application.Tests.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <IsPackable>false</IsPackable>
    <IsTestProject>true</IsTestProject>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="coverlet.msbuild" Version="8.0.0">
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
      <PrivateAssets>all</PrivateAssets>
    </PackageReference>
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.11.1" />
    <PackageReference Include="xunit" Version="2.9.2" />
    <PackageReference Include="xunit.runner.visualstudio" Version="2.8.2" />
    <PackageReference Include="FluentAssertions" Version="6.12.2" />
    <PackageReference Include="Moq" Version="4.20.72" />
    <PackageReference Include="coverlet.collector" Version="8.0.0" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="../application/Tai.PaymentProtection.Application.csproj" />
  </ItemGroup>

</Project>
```

- [ ] **Step 2: Create project.json**

Write `libs/payment-protection/application.tests/project.json`:

```json
{
  "name": "payment-protection-application-tests",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/payment-protection/application.tests",
  "projectType": "library",
  "tags": ["type:test", "scope:payment-protection", "layer:application"],
  "targets": {
    "test": {
      "executor": "@nx-dotnet/core:test",
      "options": { "configuration": "Debug" }
    }
  }
}
```

- [ ] **Step 3: Verify it builds**

Run: `dotnet build libs/payment-protection/application.tests/Tai.PaymentProtection.Application.Tests.csproj`
Expected: `Build succeeded.`

- [ ] **Step 4: Commit**

```bash
git add libs/payment-protection/application.tests/
git commit -m "test(payment-protection): scaffold application test project"
```

---

## Task 7: TDD `SaveClaimDraftCommand` + Validator + Handler

**Files:**
- Create: `libs/payment-protection/application.tests/UseCases/Drafts/SaveClaimDraftCommandHandlerTests.cs`
- Create: `libs/payment-protection/application/UseCases/Drafts/SaveClaimDraftCommand.cs`

- [ ] **Step 1: Write the failing test**

Write `libs/payment-protection/application.tests/UseCases/Drafts/SaveClaimDraftCommandHandlerTests.cs`:

```csharp
using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using MediatR;
using Moq;
using Tai.PaymentProtection.Application.Events;
using Tai.PaymentProtection.Application.Interfaces;
using Tai.PaymentProtection.Application.UseCases.Drafts;
using Tai.PaymentProtection.Domain.Entities;
using Xunit;

namespace Tai.PaymentProtection.Application.Tests.UseCases.Drafts;

public class SaveClaimDraftCommandHandlerTests {
  private readonly Mock<IClaimDraftStore> _store = new();
  private readonly Mock<IPublisher> _publisher = new();
  private readonly SaveClaimDraftCommandHandler _handler;
  private readonly SaveClaimDraftCommandValidator _validator = new();

  public SaveClaimDraftCommandHandlerTests() {
    _handler = new SaveClaimDraftCommandHandler(_store.Object, _publisher.Object);
  }

  [Fact]
  public async Task Handle_NewDraft_PersistsAndPublishesEvent() {
    var payload = new byte[] { 1, 2, 3 };
    var command = new SaveClaimDraftCommand("user-1", "claim-1", payload, TimeSpan.FromHours(24));

    _store.Setup(s => s.GetAsync("user-1", "claim-1", It.IsAny<CancellationToken>()))
          .ReturnsAsync((ClaimDraft?)null);

    await _handler.Handle(command, CancellationToken.None);

    _store.Verify(s => s.SaveAsync(
      It.Is<ClaimDraft>(d => d.UserId == "user-1" && d.ClaimId == "claim-1" && d.EncryptedPayload.Length == 3),
      It.IsAny<CancellationToken>()), Times.Once);
    _publisher.Verify(p => p.Publish(
      It.Is<ClaimDraftSavedEvent>(e => e.UserId == "user-1" && e.ClaimId == "claim-1"),
      It.IsAny<CancellationToken>()), Times.Once);
  }

  [Fact]
  public async Task Handle_ExistingDraft_UpdatesInPlace() {
    var existing = new ClaimDraft("user-1", "claim-1", new byte[] { 9 }, DateTimeOffset.UtcNow.AddHours(1));
    _store.Setup(s => s.GetAsync("user-1", "claim-1", It.IsAny<CancellationToken>()))
          .ReturnsAsync(existing);

    var newPayload = new byte[] { 1, 2, 3 };
    var command = new SaveClaimDraftCommand("user-1", "claim-1", newPayload, TimeSpan.FromHours(24));

    await _handler.Handle(command, CancellationToken.None);

    existing.EncryptedPayload.Should().BeEquivalentTo(newPayload);
    _store.Verify(s => s.SaveAsync(existing, It.IsAny<CancellationToken>()), Times.Once);
  }

  [Theory]
  [InlineData("", "claim-1", "UserId")]
  [InlineData("user-1", "", "ClaimId")]
  public void Validator_RejectsMissingIds(string userId, string claimId, string field) {
    var cmd = new SaveClaimDraftCommand(userId, claimId, new byte[] { 1 }, TimeSpan.FromHours(1));
    var result = _validator.Validate(cmd);
    result.IsValid.Should().BeFalse();
    result.Errors.Should().Contain(e => e.PropertyName == field);
  }

  [Fact]
  public void Validator_RejectsEmptyPayload() {
    var cmd = new SaveClaimDraftCommand("user-1", "claim-1", Array.Empty<byte>(), TimeSpan.FromHours(1));
    var result = _validator.Validate(cmd);
    result.IsValid.Should().BeFalse();
    result.Errors.Should().Contain(e => e.PropertyName == "EncryptedPayload");
  }
}
```

- [ ] **Step 2: Run test to verify it fails to compile**

Run: `dotnet test libs/payment-protection/application.tests/Tai.PaymentProtection.Application.Tests.csproj`
Expected: build error — `SaveClaimDraftCommand` and friends not defined.

- [ ] **Step 3: Write the command, validator, and handler**

Write `libs/payment-protection/application/UseCases/Drafts/SaveClaimDraftCommand.cs`:

```csharp
using System;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using MediatR;
using Tai.PaymentProtection.Application.Events;
using Tai.PaymentProtection.Application.Interfaces;
using Tai.PaymentProtection.Domain.Entities;

namespace Tai.PaymentProtection.Application.UseCases.Drafts;

public record SaveClaimDraftCommand(
  string UserId,
  string ClaimId,
  byte[] EncryptedPayload,
  TimeSpan Ttl
) : IRequest;

public class SaveClaimDraftCommandValidator : AbstractValidator<SaveClaimDraftCommand> {
  public SaveClaimDraftCommandValidator() {
    RuleFor(x => x.UserId).NotEmpty();
    RuleFor(x => x.ClaimId).NotEmpty();
    RuleFor(x => x.EncryptedPayload).NotEmpty();
    RuleFor(x => x.Ttl).Must(t => t > TimeSpan.Zero).WithMessage("Ttl must be positive.");
  }
}

public class SaveClaimDraftCommandHandler : IRequestHandler<SaveClaimDraftCommand> {
  private readonly IClaimDraftStore _store;
  private readonly IPublisher _publisher;

  public SaveClaimDraftCommandHandler(IClaimDraftStore store, IPublisher publisher) {
    _store = store;
    _publisher = publisher;
  }

  public async Task Handle(SaveClaimDraftCommand request, CancellationToken cancellationToken) {
    var expiresAt = DateTimeOffset.UtcNow.Add(request.Ttl);
    var existing = await _store.GetAsync(request.UserId, request.ClaimId, cancellationToken);

    ClaimDraft draft;
    if (existing == null) {
      draft = new ClaimDraft(request.UserId, request.ClaimId, request.EncryptedPayload, expiresAt);
    } else {
      existing.Update(request.EncryptedPayload, expiresAt);
      draft = existing;
    }

    await _store.SaveAsync(draft, cancellationToken);
    await _publisher.Publish(new ClaimDraftSavedEvent(request.UserId, request.ClaimId, DateTimeOffset.UtcNow), cancellationToken);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `dotnet test libs/payment-protection/application.tests/Tai.PaymentProtection.Application.Tests.csproj --filter "FullyQualifiedName~SaveClaimDraftCommandHandlerTests"`
Expected: 4 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add libs/payment-protection/application/UseCases/Drafts/SaveClaimDraftCommand.cs libs/payment-protection/application.tests/UseCases/Drafts/SaveClaimDraftCommandHandlerTests.cs
git commit -m "feat(payment-protection): add SaveClaimDraftCommand with validator and event publish"
```

---

## Task 8: TDD `GetClaimDraftQuery` + Handler

**Files:**
- Create: `libs/payment-protection/application.tests/UseCases/Drafts/GetClaimDraftQueryHandlerTests.cs`
- Create: `libs/payment-protection/application/UseCases/Drafts/GetClaimDraftQuery.cs`

- [ ] **Step 1: Write the failing test**

Write `libs/payment-protection/application.tests/UseCases/Drafts/GetClaimDraftQueryHandlerTests.cs`:

```csharp
using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Moq;
using Tai.PaymentProtection.Application.Interfaces;
using Tai.PaymentProtection.Application.UseCases.Drafts;
using Tai.PaymentProtection.Domain.Entities;
using Xunit;

namespace Tai.PaymentProtection.Application.Tests.UseCases.Drafts;

public class GetClaimDraftQueryHandlerTests {
  private readonly Mock<IClaimDraftStore> _store = new();
  private readonly GetClaimDraftQueryHandler _handler;

  public GetClaimDraftQueryHandlerTests() {
    _handler = new GetClaimDraftQueryHandler(_store.Object);
  }

  [Fact]
  public async Task Handle_ExistingNonExpiredDraft_ReturnsResult() {
    var draft = new ClaimDraft("user-1", "claim-1", new byte[] { 1, 2 }, DateTimeOffset.UtcNow.AddHours(1));
    _store.Setup(s => s.GetAsync("user-1", "claim-1", It.IsAny<CancellationToken>())).ReturnsAsync(draft);

    var result = await _handler.Handle(new GetClaimDraftQuery("user-1", "claim-1"), CancellationToken.None);

    result.Should().NotBeNull();
    result!.EncryptedPayload.Should().BeEquivalentTo(new byte[] { 1, 2 });
  }

  [Fact]
  public async Task Handle_MissingDraft_ReturnsNull() {
    _store.Setup(s => s.GetAsync("user-1", "claim-1", It.IsAny<CancellationToken>())).ReturnsAsync((ClaimDraft?)null);

    var result = await _handler.Handle(new GetClaimDraftQuery("user-1", "claim-1"), CancellationToken.None);

    result.Should().BeNull();
  }

  [Fact]
  public async Task Handle_ExpiredDraft_ReturnsNull() {
    var expired = new ClaimDraft("user-1", "claim-1", new byte[] { 1 }, DateTimeOffset.UtcNow.AddSeconds(-1));
    _store.Setup(s => s.GetAsync("user-1", "claim-1", It.IsAny<CancellationToken>())).ReturnsAsync(expired);

    var result = await _handler.Handle(new GetClaimDraftQuery("user-1", "claim-1"), CancellationToken.None);

    result.Should().BeNull();
  }
}
```

- [ ] **Step 2: Run test to verify it fails to compile**

Run: `dotnet test libs/payment-protection/application.tests/Tai.PaymentProtection.Application.Tests.csproj --filter "FullyQualifiedName~GetClaimDraftQueryHandlerTests"`
Expected: build error — `GetClaimDraftQuery` not defined.

- [ ] **Step 3: Write the query and handler**

Write `libs/payment-protection/application/UseCases/Drafts/GetClaimDraftQuery.cs`:

```csharp
using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Tai.PaymentProtection.Application.Interfaces;

namespace Tai.PaymentProtection.Application.UseCases.Drafts;

public record GetClaimDraftQuery(string UserId, string ClaimId) : IRequest<ClaimDraftResult?>;

public record ClaimDraftResult(
  string UserId,
  string ClaimId,
  byte[] EncryptedPayload,
  DateTimeOffset ExpiresAt
);

public class GetClaimDraftQueryHandler : IRequestHandler<GetClaimDraftQuery, ClaimDraftResult?> {
  private readonly IClaimDraftStore _store;

  public GetClaimDraftQueryHandler(IClaimDraftStore store) {
    _store = store;
  }

  public async Task<ClaimDraftResult?> Handle(GetClaimDraftQuery request, CancellationToken cancellationToken) {
    var draft = await _store.GetAsync(request.UserId, request.ClaimId, cancellationToken);

    if (draft == null || draft.IsExpired(DateTimeOffset.UtcNow)) {
      return null;
    }

    return new ClaimDraftResult(draft.UserId, draft.ClaimId, draft.EncryptedPayload, draft.ExpiresAt);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `dotnet test libs/payment-protection/application.tests/Tai.PaymentProtection.Application.Tests.csproj --filter "FullyQualifiedName~GetClaimDraftQueryHandlerTests"`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add libs/payment-protection/application/UseCases/Drafts/GetClaimDraftQuery.cs libs/payment-protection/application.tests/UseCases/Drafts/GetClaimDraftQueryHandlerTests.cs
git commit -m "feat(payment-protection): add GetClaimDraftQuery with TTL-aware filter"
```

---

## Task 9: TDD `DeleteClaimDraftCommand` + Handler

**Files:**
- Create: `libs/payment-protection/application.tests/UseCases/Drafts/DeleteClaimDraftCommandHandlerTests.cs`
- Create: `libs/payment-protection/application/UseCases/Drafts/DeleteClaimDraftCommand.cs`

- [ ] **Step 1: Write the failing test**

Write `libs/payment-protection/application.tests/UseCases/Drafts/DeleteClaimDraftCommandHandlerTests.cs`:

```csharp
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Moq;
using Tai.PaymentProtection.Application.Interfaces;
using Tai.PaymentProtection.Application.UseCases.Drafts;
using Xunit;

namespace Tai.PaymentProtection.Application.Tests.UseCases.Drafts;

public class DeleteClaimDraftCommandHandlerTests {
  private readonly Mock<IClaimDraftStore> _store = new();
  private readonly DeleteClaimDraftCommandHandler _handler;
  private readonly DeleteClaimDraftCommandValidator _validator = new();

  public DeleteClaimDraftCommandHandlerTests() {
    _handler = new DeleteClaimDraftCommandHandler(_store.Object);
  }

  [Fact]
  public async Task Handle_DelegatesToStore() {
    await _handler.Handle(new DeleteClaimDraftCommand("user-1", "claim-1"), CancellationToken.None);

    _store.Verify(s => s.DeleteAsync("user-1", "claim-1", It.IsAny<CancellationToken>()), Times.Once);
  }

  [Theory]
  [InlineData("", "claim-1", "UserId")]
  [InlineData("user-1", "", "ClaimId")]
  public void Validator_RejectsMissingIds(string userId, string claimId, string field) {
    var result = _validator.Validate(new DeleteClaimDraftCommand(userId, claimId));
    result.IsValid.Should().BeFalse();
    result.Errors.Should().Contain(e => e.PropertyName == field);
  }
}
```

- [ ] **Step 2: Run test to verify it fails to compile**

Run: `dotnet test libs/payment-protection/application.tests/Tai.PaymentProtection.Application.Tests.csproj --filter "FullyQualifiedName~DeleteClaimDraftCommandHandlerTests"`
Expected: build error — `DeleteClaimDraftCommand` not defined.

- [ ] **Step 3: Write the command, validator, and handler**

Write `libs/payment-protection/application/UseCases/Drafts/DeleteClaimDraftCommand.cs`:

```csharp
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using MediatR;
using Tai.PaymentProtection.Application.Interfaces;

namespace Tai.PaymentProtection.Application.UseCases.Drafts;

public record DeleteClaimDraftCommand(string UserId, string ClaimId) : IRequest;

public class DeleteClaimDraftCommandValidator : AbstractValidator<DeleteClaimDraftCommand> {
  public DeleteClaimDraftCommandValidator() {
    RuleFor(x => x.UserId).NotEmpty();
    RuleFor(x => x.ClaimId).NotEmpty();
  }
}

public class DeleteClaimDraftCommandHandler : IRequestHandler<DeleteClaimDraftCommand> {
  private readonly IClaimDraftStore _store;

  public DeleteClaimDraftCommandHandler(IClaimDraftStore store) {
    _store = store;
  }

  public Task Handle(DeleteClaimDraftCommand request, CancellationToken cancellationToken) {
    return _store.DeleteAsync(request.UserId, request.ClaimId, cancellationToken);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `dotnet test libs/payment-protection/application.tests/Tai.PaymentProtection.Application.Tests.csproj --filter "FullyQualifiedName~DeleteClaimDraftCommandHandlerTests"`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add libs/payment-protection/application/UseCases/Drafts/DeleteClaimDraftCommand.cs libs/payment-protection/application.tests/UseCases/Drafts/DeleteClaimDraftCommandHandlerTests.cs
git commit -m "feat(payment-protection): add DeleteClaimDraftCommand"
```

---

## Task 10: Run full application-layer test suite

**Files:**
- (no changes — verification only)

**🛑 Hard-stop checkpoint:** Application layer fully built and tested before infrastructure starts.

- [ ] **Step 1: Run all payment-protection.application tests**

Run: `dotnet test libs/payment-protection/application.tests/Tai.PaymentProtection.Application.Tests.csproj`
Expected: 10 tests pass, 0 fail (4 Save + 3 Get + 3 Delete).

- [ ] **Step 2: Confirm portal-api unit tests still pass (regression check)**

Run: `dotnet test libs/core/application.tests/Tai.Portal.Core.Application.Tests.csproj`
Expected: existing portal-api app tests still all pass (no regression — we haven't touched core).

---

## Task 11: Scaffold `libs/payment-protection/infrastructure` project

**Files:**
- Create: `libs/payment-protection/infrastructure/Tai.PaymentProtection.Infrastructure.csproj`
- Create: `libs/payment-protection/infrastructure/project.json`

- [ ] **Step 1: Create the csproj**

Write `libs/payment-protection/infrastructure/Tai.PaymentProtection.Infrastructure.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <RootNamespace>Tai.PaymentProtection.Infrastructure</RootNamespace>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.EntityFrameworkCore" Version="10.0.0" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.Design" Version="10.0.0">
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
      <PrivateAssets>all</PrivateAssets>
    </PackageReference>
    <PackageReference Include="Microsoft.EntityFrameworkCore.Tools" Version="10.0.0">
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
      <PrivateAssets>all</PrivateAssets>
    </PackageReference>
    <PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL" Version="10.0.0" />
    <PackageReference Include="MediatR" Version="14.1.0" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="../domain/Tai.PaymentProtection.Domain.csproj" />
    <ProjectReference Include="../application/Tai.PaymentProtection.Application.csproj" />
    <ProjectReference Include="../../core/infrastructure/Tai.Portal.Core.Infrastructure.csproj" />
  </ItemGroup>

</Project>
```

- [ ] **Step 2: Create project.json**

Write `libs/payment-protection/infrastructure/project.json`:

```json
{
  "name": "payment-protection-infrastructure",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/payment-protection/infrastructure",
  "projectType": "library",
  "tags": ["type:lib", "scope:payment-protection", "layer:infrastructure"],
  "targets": {
    "build": {
      "executor": "@nx-dotnet/core:build",
      "options": { "configuration": "Debug", "noDependencies": true },
      "configurations": { "production": { "configuration": "Release" } }
    }
  }
}
```

- [ ] **Step 3: Verify it builds**

Run: `dotnet build libs/payment-protection/infrastructure/Tai.PaymentProtection.Infrastructure.csproj`
Expected: `Build succeeded.`

- [ ] **Step 4: Commit**

```bash
git add libs/payment-protection/infrastructure/
git commit -m "feat(payment-protection): scaffold infrastructure project"
```

---

## Task 12: Create `PaymentProtectionDbContext` + `ClaimDraftConfiguration`

**Files:**
- Create: `libs/payment-protection/infrastructure/Persistence/PaymentProtectionDbContext.cs`
- Create: `libs/payment-protection/infrastructure/Persistence/Configurations/ClaimDraftConfiguration.cs`

- [ ] **Step 1: Write the entity configuration**

Write `libs/payment-protection/infrastructure/Persistence/Configurations/ClaimDraftConfiguration.cs`:

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Tai.PaymentProtection.Domain.Entities;

namespace Tai.PaymentProtection.Infrastructure.Persistence.Configurations;

public class ClaimDraftConfiguration : IEntityTypeConfiguration<ClaimDraft> {
  public void Configure(EntityTypeBuilder<ClaimDraft> builder) {
    builder.ToTable("claim_drafts");

    builder.HasKey(d => new { d.UserId, d.ClaimId });

    builder.Property(d => d.UserId).HasMaxLength(64).IsRequired();
    builder.Property(d => d.ClaimId).HasMaxLength(64).IsRequired();
    builder.Property(d => d.EncryptedPayload).HasColumnType("bytea").IsRequired();
    builder.Property(d => d.ExpiresAt).IsRequired();

    builder.Property(d => d.CreatedAt).IsRequired();
    builder.Property(d => d.CreatedBy).HasMaxLength(64);
    builder.Property(d => d.LastModifiedAt);
    builder.Property(d => d.LastModifiedBy).HasMaxLength(64);

    builder.HasIndex(d => d.ExpiresAt);
  }
}
```

- [ ] **Step 2: Write the DbContext**

Write `libs/payment-protection/infrastructure/Persistence/PaymentProtectionDbContext.cs`:

```csharp
using Microsoft.EntityFrameworkCore;
using Tai.PaymentProtection.Domain.Entities;

namespace Tai.PaymentProtection.Infrastructure.Persistence;

/// <summary>
/// EF Core context for the Payment Protection bounded context.
/// Lives in the 'payment_protection' Postgres schema (separate from 'public'
/// which hosts PortalDbContext). Has its own __EFMigrationsHistory table inside
/// the same schema so the two contexts can evolve independently.
/// </summary>
public class PaymentProtectionDbContext : DbContext {
  public const string SchemaName = "payment_protection";

  public DbSet<ClaimDraft> ClaimDrafts => Set<ClaimDraft>();

  public PaymentProtectionDbContext(DbContextOptions<PaymentProtectionDbContext> options) : base(options) { }

  protected override void OnModelCreating(ModelBuilder modelBuilder) {
    base.OnModelCreating(modelBuilder);
    modelBuilder.HasDefaultSchema(SchemaName);
    modelBuilder.ApplyConfigurationsFromAssembly(typeof(PaymentProtectionDbContext).Assembly);
  }
}
```

- [ ] **Step 3: Verify it builds**

Run: `dotnet build libs/payment-protection/infrastructure/Tai.PaymentProtection.Infrastructure.csproj`
Expected: `Build succeeded.`

- [ ] **Step 4: Commit**

```bash
git add libs/payment-protection/infrastructure/Persistence/
git commit -m "feat(payment-protection): add PaymentProtectionDbContext + ClaimDraftConfiguration"
```

---

## Task 13: Generate and apply EF migration

**Files:**
- Create: `libs/payment-protection/infrastructure/Persistence/Migrations/<timestamp>_InitialPaymentProtection.cs` (EF generated)
- Create: `libs/payment-protection/infrastructure/Persistence/Migrations/<timestamp>_InitialPaymentProtection.Designer.cs` (EF generated)
- Create: `libs/payment-protection/infrastructure/Persistence/Migrations/PaymentProtectionDbContextModelSnapshot.cs` (EF generated)

The migration must run against a startup project that wires the DbContext. We'll borrow the new `borrower-portal-api` (created in Task 16) — but to keep this task self-contained, we use an `IDesignTimeDbContextFactory` so `dotnet ef` works without any host project.

- [ ] **Step 1: Add a design-time factory**

Write `libs/payment-protection/infrastructure/Persistence/PaymentProtectionDbContextFactory.cs`:

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Tai.PaymentProtection.Infrastructure.Persistence;

/// <summary>
/// Used by 'dotnet ef migrations add/update' so the CLI can build the context
/// without booting borrower-portal-api. Connection string matches docker-compose.
/// </summary>
public class PaymentProtectionDbContextFactory : IDesignTimeDbContextFactory<PaymentProtectionDbContext> {
  public PaymentProtectionDbContext CreateDbContext(string[] args) {
    var connectionString = "Host=localhost;Port=5432;Database=portal;Username=postgres;Password=postgres";
    var options = new DbContextOptionsBuilder<PaymentProtectionDbContext>()
      .UseNpgsql(connectionString, o => {
        o.MigrationsAssembly("Tai.PaymentProtection.Infrastructure");
        o.MigrationsHistoryTable("__EFMigrationsHistory", PaymentProtectionDbContext.SchemaName);
      })
      .Options;
    return new PaymentProtectionDbContext(options);
  }
}
```

- [ ] **Step 2: Build the infrastructure project**

Run: `dotnet build libs/payment-protection/infrastructure/Tai.PaymentProtection.Infrastructure.csproj`
Expected: `Build succeeded.`

- [ ] **Step 3: Generate the initial migration**

Run from repo root:

```bash
dotnet ef migrations add InitialPaymentProtection \
  --project libs/payment-protection/infrastructure/Tai.PaymentProtection.Infrastructure.csproj \
  --output-dir Persistence/Migrations
```

Expected: three new files appear under `libs/payment-protection/infrastructure/Persistence/Migrations/`. The generated migration's `Up()` should `CREATE SCHEMA payment_protection` and `CREATE TABLE payment_protection.claim_drafts`.

- [ ] **Step 4: Confirm Postgres is running**

Run: `docker compose ps postgres`
Expected: `portal-db` listed as `Up`. If not: `docker compose up -d postgres`.

- [ ] **Step 5: Apply the migration**

Run: `dotnet ef database update --project libs/payment-protection/infrastructure/Tai.PaymentProtection.Infrastructure.csproj`
Expected: `Done.` Schema and table now exist.

- [ ] **Step 6: Verify schema in Postgres**

Run: `docker compose exec postgres psql -U postgres -d portal -c "\dt payment_protection.*"`
Expected output includes:
```
 payment_protection | __EFMigrationsHistory | table | postgres
 payment_protection | claim_drafts          | table | postgres
```

- [ ] **Step 7: Commit**

```bash
git add libs/payment-protection/infrastructure/Persistence/Migrations/ libs/payment-protection/infrastructure/Persistence/PaymentProtectionDbContextFactory.cs
git commit -m "feat(payment-protection): initial EF migration creates payment_protection schema"
```

---

## Task 14: Implement `EfClaimDraftStore` + integration test

**Files:**
- Create: `libs/payment-protection/infrastructure.tests/Tai.PaymentProtection.Infrastructure.Tests.csproj`
- Create: `libs/payment-protection/infrastructure.tests/project.json`
- Create: `libs/payment-protection/infrastructure.tests/Persistence/EfClaimDraftStoreTests.cs`
- Create: `libs/payment-protection/infrastructure/Persistence/EfClaimDraftStore.cs`

**🛑 Hard-stop checkpoint after this task:** Persistence works end-to-end at the data layer.

- [ ] **Step 1: Create infrastructure test project**

Write `libs/payment-protection/infrastructure.tests/Tai.PaymentProtection.Infrastructure.Tests.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <IsPackable>false</IsPackable>
    <IsTestProject>true</IsTestProject>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.11.1" />
    <PackageReference Include="xunit" Version="2.9.2" />
    <PackageReference Include="xunit.runner.visualstudio" Version="2.8.2" />
    <PackageReference Include="FluentAssertions" Version="6.12.2" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.InMemory" Version="10.0.0" />
    <PackageReference Include="coverlet.collector" Version="8.0.0" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="../infrastructure/Tai.PaymentProtection.Infrastructure.csproj" />
  </ItemGroup>

</Project>
```

- [ ] **Step 2: Create project.json for tests**

Write `libs/payment-protection/infrastructure.tests/project.json`:

```json
{
  "name": "payment-protection-infrastructure-tests",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/payment-protection/infrastructure.tests",
  "projectType": "library",
  "tags": ["type:test", "scope:payment-protection", "layer:infrastructure"],
  "targets": {
    "test": {
      "executor": "@nx-dotnet/core:test",
      "options": { "configuration": "Debug" }
    }
  }
}
```

- [ ] **Step 3: Write the failing test (uses EF InMemory provider for fast feedback)**

Write `libs/payment-protection/infrastructure.tests/Persistence/EfClaimDraftStoreTests.cs`:

```csharp
using System;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Tai.PaymentProtection.Domain.Entities;
using Tai.PaymentProtection.Infrastructure.Persistence;
using Xunit;

namespace Tai.PaymentProtection.Infrastructure.Tests.Persistence;

public class EfClaimDraftStoreTests {
  private static PaymentProtectionDbContext NewInMemoryContext() {
    var options = new DbContextOptionsBuilder<PaymentProtectionDbContext>()
      .UseInMemoryDatabase(Guid.NewGuid().ToString())
      .Options;
    return new PaymentProtectionDbContext(options);
  }

  [Fact]
  public async Task SaveAsync_NewDraft_PersistsRow() {
    using var ctx = NewInMemoryContext();
    var store = new EfClaimDraftStore(ctx);
    var draft = new ClaimDraft("user-1", "claim-1", new byte[] { 1, 2 }, DateTimeOffset.UtcNow.AddHours(1));

    await store.SaveAsync(draft);

    var loaded = await ctx.ClaimDrafts.FindAsync("user-1", "claim-1");
    loaded.Should().NotBeNull();
    loaded!.EncryptedPayload.Should().BeEquivalentTo(new byte[] { 1, 2 });
  }

  [Fact]
  public async Task GetAsync_ReturnsExistingDraft() {
    using var ctx = NewInMemoryContext();
    var store = new EfClaimDraftStore(ctx);
    var draft = new ClaimDraft("user-1", "claim-1", new byte[] { 9 }, DateTimeOffset.UtcNow.AddHours(1));
    await store.SaveAsync(draft);

    var loaded = await store.GetAsync("user-1", "claim-1");

    loaded.Should().NotBeNull();
    loaded!.UserId.Should().Be("user-1");
  }

  [Fact]
  public async Task GetAsync_MissingDraft_ReturnsNull() {
    using var ctx = NewInMemoryContext();
    var store = new EfClaimDraftStore(ctx);

    var loaded = await store.GetAsync("user-1", "claim-1");

    loaded.Should().BeNull();
  }

  [Fact]
  public async Task DeleteAsync_RemovesDraft() {
    using var ctx = NewInMemoryContext();
    var store = new EfClaimDraftStore(ctx);
    var draft = new ClaimDraft("user-1", "claim-1", new byte[] { 1 }, DateTimeOffset.UtcNow.AddHours(1));
    await store.SaveAsync(draft);

    await store.DeleteAsync("user-1", "claim-1");

    var loaded = await ctx.ClaimDrafts.FindAsync("user-1", "claim-1");
    loaded.Should().BeNull();
  }

  [Fact]
  public async Task DeleteAsync_MissingDraft_DoesNotThrow() {
    using var ctx = NewInMemoryContext();
    var store = new EfClaimDraftStore(ctx);

    var act = async () => await store.DeleteAsync("user-1", "claim-1");

    await act.Should().NotThrowAsync();
  }

  [Fact]
  public async Task SaveAsync_ExistingKey_UpdatesPayload() {
    using var ctx = NewInMemoryContext();
    var store = new EfClaimDraftStore(ctx);
    var first = new ClaimDraft("user-1", "claim-1", new byte[] { 1 }, DateTimeOffset.UtcNow.AddHours(1));
    await store.SaveAsync(first);

    var loaded = await store.GetAsync("user-1", "claim-1");
    loaded!.Update(new byte[] { 2, 3 }, DateTimeOffset.UtcNow.AddHours(2));
    await store.SaveAsync(loaded);

    var reloaded = await store.GetAsync("user-1", "claim-1");
    reloaded!.EncryptedPayload.Should().BeEquivalentTo(new byte[] { 2, 3 });
  }
}
```

- [ ] **Step 4: Run test to verify it fails to compile**

Run: `dotnet test libs/payment-protection/infrastructure.tests/Tai.PaymentProtection.Infrastructure.Tests.csproj`
Expected: build error — `EfClaimDraftStore` not defined.

- [ ] **Step 5: Implement the store**

Write `libs/payment-protection/infrastructure/Persistence/EfClaimDraftStore.cs`:

```csharp
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Tai.PaymentProtection.Application.Interfaces;
using Tai.PaymentProtection.Domain.Entities;

namespace Tai.PaymentProtection.Infrastructure.Persistence;

public class EfClaimDraftStore : IClaimDraftStore {
  private readonly PaymentProtectionDbContext _ctx;

  public EfClaimDraftStore(PaymentProtectionDbContext ctx) {
    _ctx = ctx;
  }

  public Task<ClaimDraft?> GetAsync(string userId, string claimId, CancellationToken cancellationToken = default) {
    return _ctx.ClaimDrafts
      .AsTracking()
      .FirstOrDefaultAsync(d => d.UserId == userId && d.ClaimId == claimId, cancellationToken);
  }

  public async Task SaveAsync(ClaimDraft draft, CancellationToken cancellationToken = default) {
    var existing = await _ctx.ClaimDrafts
      .FirstOrDefaultAsync(d => d.UserId == draft.UserId && d.ClaimId == draft.ClaimId, cancellationToken);

    if (existing == null) {
      _ctx.ClaimDrafts.Add(draft);
    }
    // If existing != null, EF tracking already captured the Update() mutation on the entity.

    await _ctx.SaveChangesAsync(cancellationToken);
  }

  public async Task DeleteAsync(string userId, string claimId, CancellationToken cancellationToken = default) {
    var draft = await _ctx.ClaimDrafts
      .FirstOrDefaultAsync(d => d.UserId == userId && d.ClaimId == claimId, cancellationToken);

    if (draft != null) {
      _ctx.ClaimDrafts.Remove(draft);
      await _ctx.SaveChangesAsync(cancellationToken);
    }
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `dotnet test libs/payment-protection/infrastructure.tests/Tai.PaymentProtection.Infrastructure.Tests.csproj`
Expected: 6 tests pass.

- [ ] **Step 7: Commit**

```bash
git add libs/payment-protection/infrastructure/Persistence/EfClaimDraftStore.cs libs/payment-protection/infrastructure.tests/
git commit -m "feat(payment-protection): EfClaimDraftStore implements IClaimDraftStore via PaymentProtectionDbContext"
```

---

## Task 15: Implement `ClaimDraftSavedAuditHandler`

**Files:**
- Create: `libs/payment-protection/infrastructure/Handlers/ClaimDraftSavedAuditHandler.cs`

This is the cross-cutting fan-out: when a draft is saved, log it via the existing `IMessageBus`. Future outbox handler can plug in alongside without changing the command handler.

- [ ] **Step 1: Write the handler**

Write `libs/payment-protection/infrastructure/Handlers/ClaimDraftSavedAuditHandler.cs`:

```csharp
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.Extensions.Logging;
using Tai.PaymentProtection.Application.Events;
using Tai.Portal.Core.Application.Interfaces;

namespace Tai.PaymentProtection.Infrastructure.Handlers;

/// <summary>
/// Reacts to ClaimDraftSavedEvent. Currently logs an audit line and publishes
/// to IMessageBus (LoggingMessageBus today). Future: a sibling handler could
/// write to an outbox table for RabbitMQ delivery.
/// </summary>
public class ClaimDraftSavedAuditHandler : INotificationHandler<ClaimDraftSavedEvent> {
  private readonly IMessageBus _bus;
  private readonly ILogger<ClaimDraftSavedAuditHandler> _logger;

  public ClaimDraftSavedAuditHandler(IMessageBus bus, ILogger<ClaimDraftSavedAuditHandler> logger) {
    _bus = bus;
    _logger = logger;
  }

  public async Task Handle(ClaimDraftSavedEvent notification, CancellationToken cancellationToken) {
    _logger.LogInformation("ClaimDraft saved: user={UserId} claim={ClaimId} at={SavedAt}",
      notification.UserId, notification.ClaimId, notification.SavedAt);
    await _bus.PublishAsync(notification, cancellationToken);
  }
}
```

- [ ] **Step 2: Add Microsoft.Extensions.Logging.Abstractions to infrastructure csproj if needed**

Edit `libs/payment-protection/infrastructure/Tai.PaymentProtection.Infrastructure.csproj` to add inside the existing `<ItemGroup>` of `<PackageReference>` items:

```xml
<PackageReference Include="Microsoft.Extensions.Logging.Abstractions" Version="10.0.0" />
```

- [ ] **Step 3: Verify it builds**

Run: `dotnet build libs/payment-protection/infrastructure/Tai.PaymentProtection.Infrastructure.csproj`
Expected: `Build succeeded.`

- [ ] **Step 4: Commit**

```bash
git add libs/payment-protection/infrastructure/Handlers/ClaimDraftSavedAuditHandler.cs libs/payment-protection/infrastructure/Tai.PaymentProtection.Infrastructure.csproj
git commit -m "feat(payment-protection): ClaimDraftSavedAuditHandler logs and publishes to IMessageBus"
```

---

## Task 16: Scaffold `apps/borrower-portal-api`

**Files:**
- Create: `apps/borrower-portal-api/borrower-portal-api.csproj`
- Create: `apps/borrower-portal-api/project.json`
- Create: `apps/borrower-portal-api/appsettings.json`
- Create: `apps/borrower-portal-api/appsettings.Development.json`
- Create: `apps/borrower-portal-api/Properties/launchSettings.json`

- [ ] **Step 1: Create the csproj**

Write `apps/borrower-portal-api/borrower-portal-api.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">

  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <RootNamespace>Tai.BorrowerPortal.Api</RootNamespace>
    <InvariantGlobalization>true</InvariantGlobalization>
    <LangVersion>preview</LangVersion>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="FluentValidation.DependencyInjectionExtensions" Version="11.11.0" />
    <PackageReference Include="MediatR" Version="14.1.0" />
    <PackageReference Include="Microsoft.AspNetCore.OpenApi" Version="10.0.3" />
    <PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL" Version="10.0.0" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="../../libs/payment-protection/domain/Tai.PaymentProtection.Domain.csproj" />
    <ProjectReference Include="../../libs/payment-protection/application/Tai.PaymentProtection.Application.csproj" />
    <ProjectReference Include="../../libs/payment-protection/infrastructure/Tai.PaymentProtection.Infrastructure.csproj" />
    <ProjectReference Include="../../libs/core/application/Tai.Portal.Core.Application.csproj" />
    <ProjectReference Include="../../libs/core/infrastructure/Tai.Portal.Core.Infrastructure.csproj" />
  </ItemGroup>

</Project>
```

- [ ] **Step 2: Create project.json**

Write `apps/borrower-portal-api/project.json`:

```json
{
  "name": "borrower-portal-api",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "apps/borrower-portal-api",
  "projectType": "application",
  "tags": ["type:api", "scope:payment-protection"],
  "targets": {
    "build": {
      "executor": "@nx-dotnet/core:build",
      "options": { "configuration": "Debug", "noDependencies": true },
      "configurations": { "production": { "configuration": "Release" } }
    },
    "serve": {
      "executor": "@nx-dotnet/core:serve",
      "options": { "launchProfile": "http" }
    }
  }
}
```

- [ ] **Step 3: Create appsettings.json**

Write `apps/borrower-portal-api/appsettings.json`:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "ConnectionStrings": {
    "PaymentProtection": "Host=localhost;Port=5432;Database=portal;Username=postgres;Password=postgres"
  }
}
```

- [ ] **Step 4: Create appsettings.Development.json**

Write `apps/borrower-portal-api/appsettings.Development.json`:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Information"
    }
  }
}
```

- [ ] **Step 5: Create launchSettings.json**

Write `apps/borrower-portal-api/Properties/launchSettings.json`:

```json
{
  "$schema": "https://json.schemastore.org/launchsettings.json",
  "profiles": {
    "http": {
      "commandName": "Project",
      "dotnetRunMessages": true,
      "launchBrowser": false,
      "applicationUrl": "http://localhost:5180",
      "environmentVariables": {
        "ASPNETCORE_ENVIRONMENT": "Development"
      }
    }
  }
}
```

- [ ] **Step 6: Verify it builds**

Run: `dotnet build apps/borrower-portal-api/borrower-portal-api.csproj`
Expected: `Build succeeded.`

- [ ] **Step 7: Commit**

```bash
git add apps/borrower-portal-api/
git commit -m "feat(borrower-portal-api): scaffold ASP.NET Core app + project.json + appsettings"
```

---

## Task 17: Add `XUserIdMiddleware` (auth stub)

**Files:**
- Create: `apps/borrower-portal-api/Middleware/XUserIdMiddleware.cs`

For the POC, every request must carry an `X-User-Id` header. The middleware reads it and sets `HttpContext.User` with a single `NameIdentifier` claim so `ICurrentUserService.UserId` resolves correctly. Real auth (OpenIddict) will replace this later.

- [ ] **Step 1: Write the middleware**

Write `apps/borrower-portal-api/Middleware/XUserIdMiddleware.cs`:

```csharp
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;

namespace Tai.BorrowerPortal.Api.Middleware;

/// <summary>
/// POC auth stub. Reads X-User-Id from request headers and sets HttpContext.User
/// with a NameIdentifier claim so ICurrentUserService.UserId works downstream.
/// Returns 401 if the header is missing.
///
/// To be replaced by OpenIddict bearer token validation when real auth lands.
/// </summary>
public class XUserIdMiddleware {
  public const string HeaderName = "X-User-Id";
  private readonly RequestDelegate _next;

  public XUserIdMiddleware(RequestDelegate next) {
    _next = next;
  }

  public async Task InvokeAsync(HttpContext context) {
    if (!context.Request.Headers.TryGetValue(HeaderName, out var userIdValues) || string.IsNullOrWhiteSpace(userIdValues)) {
      context.Response.StatusCode = StatusCodes.Status401Unauthorized;
      await context.Response.WriteAsync($"Missing {HeaderName} header.");
      return;
    }

    var identity = new ClaimsIdentity(authenticationType: "XUserIdStub");
    identity.AddClaim(new Claim(ClaimTypes.NameIdentifier, userIdValues!));
    context.User = new ClaimsPrincipal(identity);

    await _next(context);
  }
}
```

- [ ] **Step 2: Verify it builds**

Run: `dotnet build apps/borrower-portal-api/borrower-portal-api.csproj`
Expected: `Build succeeded.`

- [ ] **Step 3: Commit**

```bash
git add apps/borrower-portal-api/Middleware/XUserIdMiddleware.cs
git commit -m "feat(borrower-portal-api): X-User-Id header stub middleware (real auth deferred)"
```

---

## Task 18: Create `DraftController` and wire `Program.cs`

**Files:**
- Create: `apps/borrower-portal-api/Controllers/DraftController.cs`
- Create: `apps/borrower-portal-api/Program.cs`

**🛑 Hard-stop checkpoint after this task:** Backend reachable via curl before frontend cutover.

- [ ] **Step 1: Write the controller**

Write `apps/borrower-portal-api/Controllers/DraftController.cs`:

```csharp
using System;
using System.Threading.Tasks;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Tai.PaymentProtection.Application.UseCases.Drafts;
using Tai.Portal.Core.Application.Interfaces;

namespace Tai.BorrowerPortal.Api.Controllers;

[ApiController]
[Route("api/claims")]
public class DraftController : ControllerBase {
  private readonly IMediator _mediator;
  private readonly ICurrentUserService _currentUser;
  private const int DefaultTtlHours = 24;

  public DraftController(IMediator mediator, ICurrentUserService currentUser) {
    _mediator = mediator;
    _currentUser = currentUser;
  }

  public record SaveDraftRequest(string ClaimId, byte[] EncryptedPayload, int? TtlHours);

  [HttpPatch("draft")]
  public async Task<IActionResult> Save([FromBody] SaveDraftRequest request) {
    var userId = _currentUser.UserId!;
    var ttl = TimeSpan.FromHours(request.TtlHours ?? DefaultTtlHours);
    await _mediator.Send(new SaveClaimDraftCommand(userId, request.ClaimId, request.EncryptedPayload, ttl));
    return NoContent();
  }

  [HttpGet("draft/{claimId}")]
  public async Task<IActionResult> Get(string claimId) {
    var userId = _currentUser.UserId!;
    var result = await _mediator.Send(new GetClaimDraftQuery(userId, claimId));
    return result == null ? NotFound() : Ok(result);
  }

  [HttpDelete("draft/{claimId}")]
  public async Task<IActionResult> Delete(string claimId) {
    var userId = _currentUser.UserId!;
    await _mediator.Send(new DeleteClaimDraftCommand(userId, claimId));
    return NoContent();
  }
}
```

- [ ] **Step 2: Write Program.cs**

Write `apps/borrower-portal-api/Program.cs`:

```csharp
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Tai.BorrowerPortal.Api.Middleware;
using Tai.PaymentProtection.Application;
using Tai.PaymentProtection.Application.Interfaces;
using Tai.PaymentProtection.Infrastructure.Persistence;
using Tai.Portal.Core.Application.Behaviors;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Infrastructure.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddControllers();
builder.Services.AddHttpContextAccessor();

// MediatR — scan both this app's payment-protection.application assembly AND
// the infrastructure assembly (for ClaimDraftSavedAuditHandler).
builder.Services.AddMediatR(cfg => {
  cfg.RegisterServicesFromAssembly(typeof(IApplicationAssemblyMarker).Assembly);
  cfg.RegisterServicesFromAssembly(typeof(PaymentProtectionDbContext).Assembly);
  cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationPipelineBehavior<,>));
});

builder.Services.AddValidatorsFromAssembly(typeof(IApplicationAssemblyMarker).Assembly);

// EF Core — PaymentProtectionDbContext on Postgres
var connectionString = builder.Configuration.GetConnectionString("PaymentProtection");
builder.Services.AddDbContext<PaymentProtectionDbContext>(options => {
  options.UseNpgsql(connectionString, o => {
    o.MigrationsAssembly("Tai.PaymentProtection.Infrastructure");
    o.MigrationsHistoryTable("__EFMigrationsHistory", PaymentProtectionDbContext.SchemaName);
  });
});

// Adapters
builder.Services.AddScoped<IClaimDraftStore, EfClaimDraftStore>();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
builder.Services.AddScoped<IMessageBus, LoggingMessageBus>();

// CORS — allow the Angular dev server (4200) to call us from a browser
builder.Services.AddCors(options => {
  options.AddDefaultPolicy(policy => {
    policy.SetIsOriginAllowed(origin => {
      var host = new Uri(origin).Host;
      return host == "localhost" || host.EndsWith(".localhost");
    })
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials();
  });
});

var app = builder.Build();

// Validation exception → 400 ValidationProblemDetails
app.Use(async (context, next) => {
  try {
    await next(context);
  } catch (FluentValidation.ValidationException ex) {
    context.Response.StatusCode = 400;
    var problemDetails = new Microsoft.AspNetCore.Mvc.ValidationProblemDetails {
      Title = "Validation Failed",
      Status = 400
    };
    foreach (var error in ex.Errors) {
      if (!problemDetails.Errors.ContainsKey(error.PropertyName)) {
        problemDetails.Errors[error.PropertyName] = new[] { error.ErrorMessage };
      } else {
        var existing = problemDetails.Errors[error.PropertyName];
        problemDetails.Errors[error.PropertyName] = existing.Concat(new[] { error.ErrorMessage }).ToArray();
      }
    }
    await context.Response.WriteAsJsonAsync(problemDetails);
  }
});

if (app.Environment.IsDevelopment()) {
  app.MapOpenApi();
}

app.UseRouting();
app.UseCors();
app.UseMiddleware<XUserIdMiddleware>();

app.MapGet("/", () => "Borrower Portal API is running");
app.MapControllers();

app.Run();
public partial class Program { }
```

- [ ] **Step 3: Verify it builds**

Run: `dotnet build apps/borrower-portal-api/borrower-portal-api.csproj`
Expected: `Build succeeded.`

- [ ] **Step 4: Run the API**

Run (in a background terminal): `dotnet run --project apps/borrower-portal-api/borrower-portal-api.csproj`
Expected: `Now listening on: http://localhost:5180`.

- [ ] **Step 5: Smoke test with curl — missing header → 401**

Run: `curl -i http://localhost:5180/api/claims/draft/test-claim`
Expected: `HTTP/1.1 401 Unauthorized` with body `Missing X-User-Id header.`.

- [ ] **Step 6: Smoke test — GET unknown draft → 404**

Run: `curl -i -H "X-User-Id: user-1" http://localhost:5180/api/claims/draft/test-claim`
Expected: `HTTP/1.1 404 Not Found`.

- [ ] **Step 7: Smoke test — PATCH save → 204**

Run:
```bash
curl -i -X PATCH http://localhost:5180/api/claims/draft \
  -H "X-User-Id: user-1" \
  -H "Content-Type: application/json" \
  -d '{"claimId":"test-claim","encryptedPayload":"AQID","ttlHours":1}'
```
Expected: `HTTP/1.1 204 No Content`.

(`AQID` is base64 for bytes `[1,2,3]` — ASP.NET binds `byte[]` from base64.)

- [ ] **Step 8: Smoke test — GET → 200 with payload**

Run: `curl -i -H "X-User-Id: user-1" http://localhost:5180/api/claims/draft/test-claim`
Expected: `HTTP/1.1 200 OK` with JSON body containing `"encryptedPayload":"AQID"` and matching `userId`/`claimId`/`expiresAt`.

- [ ] **Step 9: Smoke test — DELETE → 204, then GET → 404**

Run:
```bash
curl -i -X DELETE -H "X-User-Id: user-1" http://localhost:5180/api/claims/draft/test-claim
curl -i -H "X-User-Id: user-1" http://localhost:5180/api/claims/draft/test-claim
```
Expected: first → `204`; second → `404`.

- [ ] **Step 10: Stop the API and commit**

Stop the running `dotnet run` process.

```bash
git add apps/borrower-portal-api/Controllers/DraftController.cs apps/borrower-portal-api/Program.cs
git commit -m "feat(borrower-portal-api): DraftController + Program.cs DI wiring (CORS, MediatR, EF, X-User-Id)"
```

---

## Task 19: Wire borrower-portal frontend to real API

**Files:**
- Modify: `apps/borrower-portal/src/app/app.config.ts`
- Modify: `apps/borrower-portal/src/app/claim/services/claim-draft.service.ts`
- Create: `apps/borrower-portal/src/environments/environment.ts`

- [ ] **Step 1: Create the environment file**

A single environment file is sufficient for the POC (no fileReplacements wiring needed in `angular.json`). Production hardening can introduce dev/prod split later.

Write `apps/borrower-portal/src/environments/environment.ts`:

```typescript
export const environment = {
  apiBaseUrl: 'http://localhost:5180/api',
};
```

- [ ] **Step 2: Replace `claim-draft.service.ts` to call the real API**

Replace the entire content of `apps/borrower-portal/src/app/claim/services/claim-draft.service.ts` with:

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { DisabilityClaimDraft } from '../+state/claim.models';
import { environment } from '../../../environments/environment';

const POC_USER_ID = 'borrower-poc-user';
const POC_CLAIM_ID = 'current';

@Injectable({ providedIn: 'root' })
export class ClaimDraftService {
  private http = inject(HttpClient);
  private headers = new HttpHeaders({ 'X-User-Id': POC_USER_ID });

  saveDraft(draft: DisabilityClaimDraft): Observable<void> {
    const encryptedPayload = btoa(unescape(encodeURIComponent(JSON.stringify(draft))));
    return this.http.patch<void>(
      `${environment.apiBaseUrl}/claims/draft`,
      { claimId: POC_CLAIM_ID, encryptedPayload, ttlHours: 24 },
      { headers: this.headers, withCredentials: true }
    );
  }

  loadDraft(): Observable<DisabilityClaimDraft> {
    return this.http.get<{ encryptedPayload: string }>(
      `${environment.apiBaseUrl}/claims/draft/${POC_CLAIM_ID}`,
      { headers: this.headers, withCredentials: true }
    ).pipe(
      map(response => JSON.parse(decodeURIComponent(escape(atob(response.encryptedPayload)))) as DisabilityClaimDraft)
    );
  }
}
```

- [ ] **Step 3: Remove the mock interceptor from `app.config.ts`**

In `apps/borrower-portal/src/app/app.config.ts`:

(a) Delete this import line entirely:
```typescript
import { mockApiInterceptor } from './claim/services/mock-api.interceptor';
```

(b) Change:
```typescript
import { provideHttpClient, withInterceptors } from '@angular/common/http';
```
to:
```typescript
import { provideHttpClient } from '@angular/common/http';
```

(c) Change:
```typescript
provideHttpClient(withInterceptors([mockApiInterceptor])),
```
to:
```typescript
provideHttpClient(),
```

- [ ] **Step 4: Verify the borrower-portal app builds**

Run: `npx nx build borrower-portal`
Expected: build succeeds. The `mock-api.interceptor.ts` file remains on disk (still imported by its `.spec.ts` test), but is no longer wired into the runtime app.

- [ ] **Step 5: Commit**

```bash
git add apps/borrower-portal/src/environments/ apps/borrower-portal/src/app/claim/services/claim-draft.service.ts apps/borrower-portal/src/app/app.config.ts
git commit -m "feat(borrower-portal): cut over from mock interceptor to borrower-portal-api"
```

---

## Task 20: End-to-end smoke test

**Files:**
- (no changes — verification only)

**🛑 Hard-stop checkpoint:** Verify everything works end-to-end before declaring the plan complete.

- [ ] **Step 1: Confirm Postgres + migration are in place**

Run: `docker compose ps postgres && docker compose exec postgres psql -U postgres -d portal -c "\dt payment_protection.*"`
Expected: `portal-db` is `Up`; output lists `payment_protection.claim_drafts` and `payment_protection.__EFMigrationsHistory`.

- [ ] **Step 2: Start borrower-portal-api in one terminal**

Run: `dotnet run --project apps/borrower-portal-api/borrower-portal-api.csproj`
Expected: `Now listening on: http://localhost:5180`.

- [ ] **Step 3: Start borrower-portal frontend in another terminal**

Run: `npx nx serve borrower-portal`
Expected: app available at `http://localhost:4200`.

- [ ] **Step 4: Manual browser smoke test — golden path**

1. Open `http://localhost:4200` in a browser.
2. Begin a disability claim wizard.
3. Fill out Step 1 (Borrower Info): First name, Last name, SSN last 4, Phone, Email.
4. Click Next → advances to Step 2.
5. Open browser DevTools → Network tab → confirm a `PATCH http://localhost:5180/api/claims/draft` call returned `204`.
6. Reload the page (Ctrl+R).
7. Re-enter the wizard → Step 1 fields should be pre-populated from the server (except SSN, which is intentionally stripped on hydration per existing security spec).
8. Open DevTools → Network → confirm a `GET http://localhost:5180/api/claims/draft/current` returned `200`.

Expected: hydration works end-to-end through the new API.

- [ ] **Step 5: Verify row in Postgres**

Run: `docker compose exec postgres psql -U postgres -d portal -c "SELECT user_id, claim_id, length(encrypted_payload), expires_at FROM payment_protection.claim_drafts;"`
Expected: one row with `user_id = borrower-poc-user`, `claim_id = current`, non-zero `length`, `expires_at` ≈ 24h from now.

- [ ] **Step 6: Stop both processes and commit**

Stop both `dotnet run` and `nx serve`. (No code changes — verification task only.)

---

## Task 21: Run full test suite for regressions

**Files:**
- (no changes — verification only)

- [ ] **Step 1: Run all .NET tests across the solution**

Run from repo root:

```bash
dotnet test libs/payment-protection/application.tests/Tai.PaymentProtection.Application.Tests.csproj && \
dotnet test libs/payment-protection/infrastructure.tests/Tai.PaymentProtection.Infrastructure.Tests.csproj && \
dotnet test libs/core/application.tests/Tai.Portal.Core.Application.Tests.csproj && \
dotnet test libs/core/domain.tests/Tai.Portal.Core.Domain.Tests.csproj && \
dotnet test libs/core/infrastructure.tests/Tai.Portal.Core.Infrastructure.Tests.csproj
```

Expected: all suites pass. Payment-protection test counts: application = 10, infrastructure = 6.

- [ ] **Step 2: Run frontend tests**

Run: `npx nx test borrower-portal`
Expected: existing borrower-portal tests still pass (we haven't touched components — only services).

- [ ] **Step 3: Final commit (if any uncommitted state from prior steps)**

```bash
git status
```
Expected: working tree clean, all changes already committed in prior tasks.

---

## Plan Complete

**What now works:**
- A new `borrower-portal-api` (.NET 10) serves PATCH/GET/DELETE `/api/claims/draft` against Postgres schema `payment_protection`.
- The borrower-portal Angular app calls the real backend instead of the mock interceptor.
- All persistence flows through the `IClaimDraftStore` port — swap to a different store later by adding one adapter + changing one DI line.
- MediatR `INotification` fan-out is in place; `ClaimDraftSavedAuditHandler` logs today, future outbox handler can attach without touching command code.
- Full Clean Architecture + CQRS + MediatR + FluentValidation, mirroring portal-api conventions.

**Explicitly deferred (call out in PR description):**
- **Real auth (OpenIddict).** Currently `X-User-Id` header stub. Replace `XUserIdMiddleware` with OpenIddict bearer validation; the controller and handlers don't change because they use `ICurrentUserService.UserId`.
- **TTL cleanup job.** No background service. Expired rows accumulate; queries filter by `IsExpired()`. Add an `IHostedService` later when storage growth matters.
- **Outbox + RabbitMQ.** Plug a second `INotificationHandler<ClaimDraftSavedEvent>` that writes to an outbox table; relay publishes to Rabbit. No changes to command handler.
- **Multi-tenancy.** `ClaimDraft` does not implement `IMultiTenantEntity`. Add the interface + `TenantId` property + apply `TenantInterceptor` when real auth carries tenant context.
- **CI pipeline / deployment manifests.** Local-dev only.
