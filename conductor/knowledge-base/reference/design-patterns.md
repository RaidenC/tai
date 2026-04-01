---
title: Design Patterns
difficulty: L1 | L2 | L3
lastUpdated: 2026-03-31
relatedTopics:
  - CSharp-Fundamentals
  - Angular-Core
  - RxJS-Signals
---

## TL;DR

Design patterns are proven, reusable solutions to recurring software engineering problems. In modern C# 14 and .NET 10, many classic "Gang of Four" patterns are now built directly into the framework (e.g., Singleton via Dependency Injection, Strategy via Switch Expressions, Observer via `System.Threading.Channels` or RxJS). Understanding patterns like Repository, Decorator, and CQRS is essential for creating clean, scalable architectures like the TAI Portal.

## Deep Dive

### Concept Overview

#### 1. Creational Patterns (Singleton, Builder, Factory)
- **Singleton:** Ensures only one instance of a class exists globally. 
  - *Modern .NET Context:* Hand-rolling a Singleton with `private static instance` is considered an anti-pattern. Instead, use the Dependency Injection (DI) container: `builder.Services.AddSingleton<ICache, MemoryCache>()`.
- **Builder:** Separates the construction of a complex object from its representation.
  - *Modern .NET Context:* The `WebApplication.CreateBuilder(args)` pattern in .NET 10 is the ultimate example. In Angular, `FormBuilder` constructs complex reactive forms.

#### 2. Structural Patterns (Decorator, Facade)
- **Decorator:** Dynamically adds behaviors to an object without altering its code.
  - *Modern .NET Context:* ASP.NET Core **Middleware** (e.g., `TenantResolutionMiddleware`) decorates the HTTP pipeline. **MediatR Pipeline Behaviors** decorate application commands (e.g., adding logging or validation before a database save).
- **Facade:** Provides a simplified, higher-level interface to a complex subsystem.
  - *Modern .NET Context:* Instead of components directly managing `UserManager`, `RoleManager`, and `SignInManager`, we create an `IdentityService` Facade that exposes a simple `RegisterUserAsync()` method.

#### 3. Behavioral Patterns (Strategy, Observer, Mediator, State)
- **Strategy:** Encapsulates a family of algorithms, making them interchangeable.
  - *Modern .NET Context:* Complex OOP inheritance hierarchies are now often replaced by C# **Switch Expressions** with Relational Patterns, or by injecting different delegates (`Func<T>`).
- **Observer:** A publish-subscribe model where a subject notifies observers of state changes.
  - *Modern Context:* The backbone of modern frontends. Angular's `BehaviorSubject` (RxJS) and Signals natively implement this. On the backend, `SignalR` handles real-time pub/sub.
- **Mediator:** Reduces chaotic dependencies between objects by forcing them to communicate via a mediator object.
  - *Modern .NET Context:* The **MediatR** library is the industry standard. Instead of Controllers injecting 5 different services, they inject `IMediator` and send a single Command/Query object.
- **State:** Allows an object to alter its behavior when its internal state changes.
  - *Modern .NET Context:* Implemented in Domain-Driven Design (DDD) as a **State Machine** inside an Aggregate Root (e.g., `ApplicationUser.Status` governing transitions from `Created` to `Active`).

#### 4. Architectural Patterns & Principles (Clean Architecture, SOLID, CQRS)
- **Clean Architecture (Onion Architecture):** A layered system design where dependencies point **inwards** toward the core Domain. 
  - *TAI Portal Context:* The `Domain` layer has 0 dependencies. The `Application` layer depends on Domain. The `Infrastructure` and `Presentation` layers depend on Application. The database is an implementation detail, not the center of the universe.
- **SOLID Principles:** Five core principles for object-oriented design:
  - **S (Single Responsibility):** A class should have one reason to change. *Example:* CQRS completely separates `GetUsersQuery` from `RegisterUserCommand`.
  - **O (Open/Closed):** Open for extension, closed for modification. *Example:* Adding a new MediatR `IPipelineBehavior` (like caching) without modifying any existing handlers.
  - **L (Liskov Substitution):** Subtypes must be substitutable for base types. *Example:* Injecting `InMemoryCache` in testing vs `RedisCache` in production.
  - **I (Interface Segregation):** Many client-specific interfaces are better than one general-purpose interface. *Example:* Having `IReadUserRepository` and `IWriteUserRepository` instead of a massive `IGenericRepository<T>`.
  - **D (Dependency Inversion):** Depend on abstractions, not concretions. *Example:* Application layer defines `IEmailService`; Infrastructure layer implements it.
- **CQRS (Command Query Responsibility Segregation):** Separates read operations (Queries) from write operations (Commands). This is the architectural foundation of `tai-portal`, implemented via MediatR.
- **Repository:** Abstracts data access. Note that EF Core's `DbContext` is already a Unit of Work, and `DbSet<T>` is a Repository.

### Real-World Example (from tai-portal)

The **Decorator Pattern** is heavily utilized in the `tai-portal` backend via MediatR's `IPipelineBehavior`. Instead of copying and pasting validation logic into every single Command handler, we write a single Decorator that wraps *every* request. 

[View ValidationPipelineBehavior.cs](../../../libs/core/application/Behaviors/ValidationPipelineBehavior.cs)

```csharp
// Example from libs/core/application/Behaviors/ValidationPipelineBehavior.cs
// This acts as a Decorator around EVERY command in the system.
public class ValidationPipelineBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse> {
    private readonly IEnumerable<IValidator<TRequest>> _validators;

    public ValidationPipelineBehavior(IEnumerable<IValidator<TRequest>> validators) {
        _validators = validators;
    }

    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken) {
        if (!_validators.Any()) return await next(); // Proceed to next decorator

        var context = new ValidationContext<TRequest>(request);
        
        // Execute all FluentValidation rules
        var validationResults = await Task.WhenAll(_validators.Select(v => v.ValidateAsync(context, cancellationToken)));
        var failures = validationResults.SelectMany(r => r.Errors).Where(f => f != null).ToList();

        if (failures.Count != 0)
            throw new ValidationException(failures);

        // If valid, continue the pipeline (call the actual handler)
        return await next();
    }
}
```

### Key Takeaways
- **Framework over Boilerplate:** Don't write classic Gang-of-Four boilerplate if .NET 10 or Angular 21 provides it natively (e.g., DI for Singletons, RxJS for Observers).
- **Favor Composition:** Use Decorators (Middleware/Behaviors) to compose cross-cutting concerns (logging, caching, validation) rather than using inheritance.
- **Architectural Clarity:** CQRS prevents bloated "God Services" by strictly splitting read models (fast, un-tracked) from write models (rich domain entities).

---

## Interview Q&A

### L1: Modern Singleton
**Difficulty:** L1 (Junior)

**Question:** How do you implement the Singleton pattern in a modern .NET application?

**Answer:** Rather than writing a thread-safe `private static instance` with locks, you register the class with the built-in Dependency Injection container using `builder.Services.AddSingleton<IMyService, MyService>()`. The framework guarantees only one instance is created and shared across the application lifecycle.

---

### L2: Facade vs Adapter
**Difficulty:** L2 (Mid-Level)

**Question:** What is the difference between the Facade pattern and the Adapter pattern?

**Answer:** A Facade simplifies a complex subsystem by providing a higher-level, easy-to-use interface (like `IdentityService` hiding the complexity of `UserManager` and EF Core). An Adapter changes an incompatible interface into one the client expects, acting as a translator between two existing systems without necessarily simplifying the underlying logic.

---

### L2: The Observer Pattern in UI
**Difficulty:** L2 (Mid-Level)

**Question:** How is the Observer pattern implemented natively in modern Angular applications?

**Answer:** It is implemented using RxJS (`Observable`, `Subject`, `BehaviorSubject`) and Angular Signals. The component (Observer) subscribes to a stream of data (the Subject). When the data changes, the Subject pushes the new value to all subscribers, triggering Angular's change detection to update the UI automatically.

---

### L3: Generic Repository Anti-Pattern
**Difficulty:** L3 (Senior)

**Question:** In many older .NET projects, you see a custom `IGenericRepository<T>` wrapping EF Core. Why is this increasingly considered an anti-pattern in modern architectures, and what should you do instead?

**Answer:** EF Core already implements the core data patterns: `DbContext` is a Unit of Work, and `DbSet<T>` is a generic Repository. Wrapping them in a custom generic repository usually just duplicates the framework's API while hiding its powerful features (like `Include` or `AsNoTracking`). Instead, you should inject `DbContext` directly into CQRS Handlers, or create highly specific Domain Repositories (e.g., `IUserRepository`) that expose strict business operations rather than generic CRUD.

---

### L3: The Decorator Pattern (Middleware/Pipelines)
**Difficulty:** L3 (Senior)

**Question:** Explain how ASP.NET Core Middleware and MediatR Pipeline Behaviors relate to the Decorator pattern. What problem do they solve?

**Answer:** Both are functional implementations of the Decorator pattern. They "wrap" the core execution logic, allowing you to run code before and after the main handler without modifying the handler itself. This solves the problem of "cross-cutting concerns." Instead of writing logging, validation, and transaction management inside every single API endpoint or CQRS handler, you write them once in a pipeline behavior, and the framework automatically decorates every request with those features.

---

### L2: Clean Architecture Dependency Rule
**Difficulty:** L2 (Mid-Level)

**Question:** In Clean Architecture, what is the "Dependency Rule" and how does it prevent spaghetti code?

**Answer:** The Dependency Rule states that source code dependencies must point only **inward**, toward higher-level policies (the Domain). The Domain layer knows nothing about the database, UI, or frameworks. The Infrastructure layer (which contains EF Core and API controllers) points inward to the Application and Domain layers. This prevents UI or database framework changes from rippling into the core business logic.

---

### L3: SOLID Principles in Practice
**Difficulty:** L3 (Senior)

**Question:** How does the combination of MediatR (CQRS) and Pipeline Behaviors inherently enforce the Single Responsibility Principle (SRP) and Open/Closed Principle (OCP)?

**Answer:** Under CQRS, each MediatR Handler does exactly one thing (SRP)—it handles one specific Command or Query. It doesn't mix read logic with write logic. Pipeline Behaviors enforce OCP because you can globally add new cross-cutting concerns (like logging, telemetry, or transaction wrapping) by simply registering a new `IPipelineBehavior` in the DI container. You are extending the system's behavior (Open for extension) without modifying any existing handler code (Closed for modification).

---

## Cross-References
- [[CSharp-Fundamentals]] — Explains modern C# 14 features that replace older OOP patterns.
- [[Angular-Core]] — Details how Dependency Injection works in the frontend framework.
- [[RxJS-Signals]] — Deep dive into the Observer pattern implementations in modern UI.

---

## Further Reading
- [Design Patterns in C# (.NET 8/10)](https://refactoring.guru/design-patterns/csharp)
- [MediatR Pipeline Behaviors](https://github.com/jbogard/MediatR/wiki/Behaviors)
- [libs/core/application/Behaviors/ValidationPipelineBehavior.cs](../../../libs/core/application/Behaviors/ValidationPipelineBehavior.cs)

---

*Last updated: 2026-03-31*