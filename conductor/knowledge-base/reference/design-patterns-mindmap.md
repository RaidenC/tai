---
markmap:
  initialExpandLevel: 4
  colorFreezeLevel: 3
  spacingVertical: 12
---

# 1. Design Patterns

## **1.1 Creational Patterns**
1. Singleton (DI-Managed)
   - `AddSingleton<TInterface, TImpl>()` replaces hand-rolled double-checked locking
   - DI container guarantees thread-safe creation, sharing, and disposal
   - Never use for per-request state (DbContext, ITenantService)
2. Builder
   - `WebApplication.CreateBuilder(args)` — .NET's flagship Builder
   - Angular `FormBuilder` for complex reactive forms
   - Separates construction (which services, which config) from representation
3. Factory
   - `Activator.CreateInstance()` in `DispatchDomainEventsAsync` creates `DomainEventNotification<T>` at runtime
   - .NET 10 keyed DI services replace manual factory `switch` statements
   - Bypasses compile-time type checking — runtime failures

## **1.2 Structural Patterns**
1. Decorator (Middleware & Pipeline)
   - ASP.NET Middleware: HTTP Decorator chain (`GatewayTrust → Auth → TenantResolution`)
   - MediatR `IPipelineBehavior`: business logic Decorator (`Validation → Logging → Handler`)
   - Middleware = "can request enter?" / Pipeline = "is request valid?"
2. Facade
   - `IIdentityService` wraps `UserManager`, `RoleManager`, `SignInManager`, `DbContext`
   - Handlers call one method instead of juggling four services
   - Risk: Facades becoming "God Services" if not split by concern
3. Marker Interface
   - `IMultiTenantEntity` tags entities for automatic Global Query Filter application
   - `TenantInterceptor` uses marker to auto-populate TenantId on insert
   - Behavior configured at startup via reflection, invisible at call site
4. Anti-Corruption Layer (ACL)
   - `IdentityService` translates `IdentityResult` → domain `Result`
   - `LoggingMessageBus` stubs future broker behind domain `IMessageBus`
   - Interface in Application layer, implementation in Infrastructure

## **1.3 Behavioral Patterns**
1. Mediator (MediatR)
   - Controller injects `IMediator`, sends typed Command/Query records
   - Pipeline runs validation, logging, tenant scoping between controller and handler
   - Trade-off: "Find All References" harder — search by Command/Query type
2. Observer (Domain Events)
   - `ApplicationUser._domainEvents` list, dispatched by `PortalDbContext`
   - `IPublisher` routes to handlers: `UserApprovedEventHandler`, `LoginAnomalyEventHandler`
   - Domain entity has zero knowledge of subscribers
3. State Machine
   - `ApplicationUser.Status` with `private set` — only transition methods change it
   - `Created → PendingApproval → PendingVerification → Active`
   - Each method enforces preconditions and raises correct domain event
4. Strategy
   - `IRealTimeNotifier` / `SignalRRealTimeNotifier` — swap via DI registration
   - `IMessageBus` / `LoggingMessageBus` → future `RabbitMqMessageBus`
   - Simple cases: C# 14 switch expressions with pattern matching
5. Specification
   - Encapsulates business rules as composable `Expression<Func<T, bool>>`
   - `ActiveUsersSpec().And(InTenantSpec(tenantId))` — reusable across handlers
   - Not yet in tai-portal; Global Query Filters cover tenant filtering

## **1.4 Architectural Patterns**
1. Clean Architecture (Onion)
   - Dependencies point inward: Domain (zero deps) ← Application ← Infrastructure ← Presentation
   - Domain defines interfaces; Infrastructure implements them
   - Trade-off: more files and indirection, but framework-agnostic domain
2. CQRS (Command Query Responsibility Segregation)
   - Every operation is a Command (write) or Query (read) — never both
   - Each handled by exactly one `IRequestHandler`
   - Enables independent optimization of read/write paths
3. Repository vs Direct DbContext
   - `DbContext` is already Unit of Work; `DbSet<T>` is already Repository
   - tai-portal uses domain-specific Facades instead of generic repositories
   - `IIdentityService` (Application) → `IdentityService` (Infrastructure)

## **1.5 Integration & Resilience Patterns**
1. Transactional Outbox
   - Writes events to `OutboxMessages` table in same DB transaction as business data
   - Background worker publishes to broker — isolates business from network failures
   - Adds eventual consistency (seconds lag) and operational complexity
2. Circuit Breaker & Retry
   - Retry: re-attempt with exponential backoff + jitter
   - Circuit Breaker: fail fast after N consecutive failures (Closed → Open → HalfOpen)
   - .NET 10 `Microsoft.Extensions.Http.Resilience` built on Polly v8
3. Saga / Process Manager
   - Coordinates multi-step workflows across aggregates/services
   - Compensating actions undo previous steps on failure
   - Choreography (event-driven) vs Orchestration (central coordinator)
