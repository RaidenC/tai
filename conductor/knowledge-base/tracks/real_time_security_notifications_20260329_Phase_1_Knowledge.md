# Track real_time_security_notifications_20260329 Phase 1 Knowledge

## The Enterprise Challenge
In high-security Fintech environments, security events (MFA failures, elevation requests) must be handled with the highest level of consistency and auditability. The challenge is to define a common language (Domain Events) that can be used by both the persistence layer (Audit Logs) and the real-time notification layer (SignalR), without coupling these distinct concerns.

## Knowledge Hierarchy

### Junior Level (The "What")
- **Domain Events:** Represent something that happened in the domain which other parts of the system need to react to. In this project, they are implemented as C# `record` types.
- **Marker Interfaces:** `IDomainEvent` is used to identify domain events throughout the codebase.
- **Records:** We use `record` for events because they are immutable by default and provide value-based equality.

### Mid Level (The "How")
- **Abstraction through Base Classes:** `SecurityEventBase` ensures that all security events carry mandatory metadata: `TenantId`, `UserId`, `CorrelationId`, and `Timestamp`.
- **Interface Segregation:** `IEventBus` is defined separately from `IMessageBus` to allow for more granular control over security event dispatching.
- **TDD (Test-Driven Development):** Writing unit tests for domain models before implementation ensures that the business requirements (like mandatory fields) are encoded into the data structure itself.

### Senior/Principal Level (The "Why")
- **Clean Architecture & Decoupling:** By defining `IEventBus` in the Application layer and the events in the Domain layer, we ensure that the business logic remains "pure." The actual implementation (e.g., SignalR, Kafka, RabbitMQ) can be swapped out in the Infrastructure layer without touching the Domain.
- **Consistency vs. Auditability:** Sharing a base class between real-time events and audit log entries ensures that the data we show the user in real-time is the exact same data we store in the permanent audit trail.
- **Traceability with Correlation IDs:** Enforcing `CorrelationId` at the base event level ensures that we can trace a security alert back to the exact API call or UI interaction that triggered it, essential for SOC 2 and FAPI 2.0 compliance.

## Deep-Dive Mechanics
The events are implemented as **Positional Records** in C#, providing a concise syntax for data-only structures. The use of `DateTimeOffset.UtcNow` ensures that timestamps are globally consistent across time zones.

## Interview Talking Points (Tiered)
- **Junior/Mid:** "I used C# records to implement immutable domain events, ensuring that the event state cannot be changed once it's fired. I also used TDD to verify the integrity of the data structures."
- **Senior/Lead:** "I designed a decoupled event-driven architecture where security events are first-class citizens in the domain. I implemented a 'SecurityEventBase' to mandate distributed tracing via Correlation IDs, ensuring all real-time alerts are fully auditable and traceable back to the gateway origin."

## March 2026 Market Context
The use of **Strongly-Typed Domain Events** and **Correlation Tracing** is the "Gold Standard" for modern Fintech identity systems. It ensures that the system is not only reactive but also fully compliant with auditing standards like FAPI 2.0 and Zero-Trust mandates.
