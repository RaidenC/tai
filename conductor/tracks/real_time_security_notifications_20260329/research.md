# Research: Real-Time Security Notifications & Audit Dashboard

## Existing Event Infrastructure
- **Domain Events:** Located in `libs/core/domain/Events`.
- **Marker Interface:** `IDomainEvent` in `libs/core/domain/Interfaces/IDomainEvent.cs`.
- **Event Dispatcher:** MediatR is used in `infrastructure` to handle domain events.
- **Integration Events:** `IMessageBus` in `libs/core/application/Interfaces/IMessageBus.cs`.
- **Logging Implementation:** `LoggingMessageBus.cs` in `libs/core/infrastructure/Services/LoggingMessageBus.cs`.
- **Audit Logs:** `AuditEntry` in `libs/core/domain/Entities/AuditEntry.cs`.

## Proposed Infrastructure
- **IEventBus:** New internal abstraction for publishing security-related events for real-time consumption.
- **SecurityEventBase:** New base class for security-specific domain events to ensure consistency.
- **Security Hub:** SignalR Hub in `apps/portal-api` to push events to the frontend.
- **Claim Check Pattern:** Only push event IDs through SignalR; frontend must fetch details via a secure API.

## Design Decisions
- Security events should implement `IDomainEvent` to be dispatchable by the existing MediatR pipeline.
- `SecurityEventBase` should include `CorrelationId`, `Timestamp`, and `TenantId`.
- The `IEventBus` will be used to explicitly publish events to the `IHostedService` (likely through an internal queue/bus).

## Integration Considerations
- **YARP:** WebSocket support must be enabled.
- **Auth:** SignalR hub must use the existing cookie-based auth.
- **Tenant Isolation:** Events must only be broadcasted to users in the same tenant (or specific groups).
- **Concurrency:** High-volume audit log writes must be handled carefully.
