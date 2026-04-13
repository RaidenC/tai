---
markmap:
  colorFreezeLevel: 3
  initialExpandLevel: 3
---

# DDD & Domain Modeling

## 1. Core Building Blocks
### Entities vs Value Objects
- **What**: Entities have persistent identity (ID); Value Objects are defined only by their attributes (struct equality).
- **Why**: Prevents "Primitive Obsession" (passing raw `Guid` instead of `TenantId`). Gives objects control of their own lifecycle.
- **How**: `class ApplicationUser` (Entity) vs `readonly record struct TenantId(Guid Value)` (Value Object).
- **When**: Use Entities for things that change over time but remain the same "thing". Use Value Objects for descriptive, immutable attributes.
- **Trade-offs**: Value Objects require extra EF Core configuration (`.HasConversion()`) and JSON serialization setup.

### Aggregates & Aggregate Roots
- **What**: A cluster of domain objects treated as a single unit. The Root is the only allowed entry point for modifications.
- **Why**: Prevents invalid state. If `OrderLine` is modified directly, `Order.Total` becomes out of sync. 
- **How**: `Tenant` modifies its own `TenantSettings` collection. External code cannot `db.Settings.Add()`.
- **When**: Define around **transactional consistency boundaries**. Everything that must save together belongs in one aggregate.
- **Trade-offs**: Large aggregates cause database concurrency conflicts. Keep them small; reference other aggregates by ID only.

### Strongly-Typed IDs
- **What**: Wrapping primitives (`Guid`, `int`, `string`) in domain-specific types (e.g., `UserId`, `TenantId`).
- **Why**: The compiler catches bugs where a developer accidentally passes a `TenantId` into a method expecting a `UserId`.
- **How**: `public readonly record struct TenantId(Guid Value);`
- **When**: Use for all domain identifiers that cross method, service, or bounded context boundaries.
- **Trade-offs**: Adds boilerplate. Often requires source generators (like Andrew Lock's `StronglyTypedId`) to minimize repetitive code.

## 2. Domain Behavior
### Rich vs Anemic Domain Model
- **What**: Rich models put business logic inside the Entity (`user.Approve()`). Anemic models use dumb property bags and put logic in Services (`userService.Approve(user)`).
- **Why**: Anemic models scatter rules. If anyone can write `user.Status = Active`, invariants are easily bypassed.
- **How**: Make properties `private set`. Expose explicit methods that validate rules before mutating state.
- **When**: Use Rich models for core business workflows (e.g., Onboarding). Use Anemic models for simple CRUD dictionaries.
- **Trade-offs**: Rich entities are harder to mock in unit tests if they have dependencies. (Solution: don't inject services into entities).

### State Machines in Entities
- **What**: The Entity itself governs which state transitions are mathematically legal.
- **Why**: Prevents users from jumping from `Created` directly to `Active` without passing through `PendingApproval`.
- **How**: `if (Status != PendingApproval) throw; Status = Active;`
- **When**: Use when an entity has 3+ states and strict business rules governing how it moves between them.
- **Trade-offs**: Makes it hard for database admins to manually "fix" data by bypassing the workflow.

### Invariant Enforcement
- **What**: Business rules that must *always* be true (e.g., "Email is never null", "TenantId always exists").
- **Why**: Bad data fails early at creation, rather than causing a `NullReferenceException` three layers deep in the database.
- **How**: Use `Guard.Against.Null(tenantId)` in the entity constructor.
- **When**: Enforce immediately on object instantiation or property mutation.
- **Trade-offs**: Makes bulk-importing dirty legacy data very difficult, as the entities will refuse to be instantiated.

## 3. Domain Events
### Event Lifecycle & Pre-Save Dispatch
- **What**: Entities generate events (`UserApprovedEvent`). They are dispatched by the DbContext *before* the SQL transaction commits.
- **Why**: Guarantees Atomicity. If the event handler fails, the database save rolls back.
- **How**: Override `SaveChangesAsync`. Collect `entity.DomainEvents`, clear them, and call `_mediator.Publish()`.
- **When**: Use for side-effects that *must* happen in the same transaction (e.g., Audit Logging).
- **Trade-offs**: Slow event handlers will hold the database transaction open, degrading system performance.

### Notification Handlers
- **What**: Classes that listen for Domain Events and react independently (Observer Pattern).
- **Why**: Keeps the Domain Entity decoupled from Infrastructure. `ApplicationUser` doesn't need to know about SignalR or SendGrid.
- **How**: `class AuditHandler : INotificationHandler<UserApprovedEvent>`
- **When**: Use for cross-cutting side effects (emails, cache invalidation, real-time UI pushes).
- **Trade-offs**: Execution order is non-deterministic. It makes the code harder to trace (the side-effect is hidden from the main method).

### Event Hierarchy
- **What**: Having all events inherit from a `BaseDomainEvent` to share common metadata.
- **Why**: Ensures every event automatically carries an `OccurredAt` timestamp and `TenantId` for audit purposes.
- **How**: `public abstract record DomainEvent : INotification { public DateTimeOffset OccurredAt { get; init; } = DateTimeOffset.UtcNow; }`
- **When**: Always. Domain Events should be immutable C# `record` types named in the past tense.
- **Trade-offs**: Getting the granularity right is hard. Too broad (`UserUpdated`) forces handlers to guess what changed. Too fine creates class explosion.

## 4. Strategic DDD
### Bounded Contexts
- **What**: A logical boundary where a specific Domain Model applies. "User" means authentication in the Identity Context, but means a payer in the Billing Context.
- **Why**: Prevents the creation of a massive, 2000-line "God Object" that tries to satisfy every department in the company.
- **How**: Contexts communicate via shared Value Objects (`TenantId`) or by publishing Domain Events.
- **When**: When different teams or features use the same word to mean completely different things.
- **Trade-offs**: Requires data duplication. The Billing context might have to save its own copy of the User's name.

### Module Boundaries (Modular Monolith)
- **What**: Enforcing Bounded Contexts using compile-time project references instead of network calls.
- **Why**: Prevents developers from accidentally tightly coupling the Identity database to the Billing database.
- **How**: In `tai-portal`, Nx linting rules (`@nx/enforce-module-boundaries`) prevent the `billing` library from importing the `identity` library directly.
- **When**: Start here! It gives you the clean separation of Microservices without the DevOps nightmare of distributed systems.
- **Trade-offs**: Adds friction. You can't just quickly `JOIN` two tables together; you have to define a proper API or Event contract.
