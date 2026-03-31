# Research: Real-Time Security Notifications & Audit Dashboard

## Existing Event Infrastructure
- **Domain Events:** Located in `libs/core/domain/Events`.
- **Marker Interface:** `IDomainEvent` in `libs/core/domain/Interfaces/IDomainEvent.cs`.
- **Event Dispatcher:** MediatR is used in `infrastructure` to handle domain events.
- **Integration Events:** `IMessageBus` in `libs/core/application/Interfaces/IMessageBus.cs`.
- **Logging Implementation:** `LoggingMessageBus.cs` in `libs/core/infrastructure/Services/LoggingMessageBus.cs`.
- **Audit Logs:** `AuditEntry` in `libs/core/domain/Entities/AuditEntry.cs`.

## Architecture: Two Communication Channels

| Channel | Target | Technology |
|---------|--------|------------|
| **Real-Time Push** | Current User (Browser) | SignalR |
| **Cross-App Events** | Other Apps (DocViewer, HR) | IMessageBus (RabbitMQ/EventBridge) |

## Key Decision: No IEventBus Abstraction
We do NOT need a separate `IEventBus` abstraction. MediatR handles internal event dispatch perfectly. This is YAGNI - don't create abstractions without multiple implementations.

## Design Decisions
- Domain events implement `IDomainEvent` to be dispatchable by the existing MediatR pipeline.
- `SecurityEventBase` includes `CorrelationId`, `Timestamp`, and `TenantId`.
- MediatR notification handlers do THREE things:
  1. Write to AuditEntry (DB)
  2. Push to SignalR (real-time to browser)
  3. Publish to IMessageBus (other apps)
- Claim Check Pattern: Only eventId + timestamp go over SignalR; full details fetched via REST.

## Integration Considerations
- **YARP:** WebSocket support must be enabled.
- **Auth:** SignalR hub must use the existing cookie-based auth.
- **Tenant Isolation:** Events must only be broadcasted to users in the same tenant via SignalR Groups.
- **Concurrency:** High-volume audit log writes must be handled carefully.
