# Privilege Edit Real-Time Notification Fix Design

## Summary

Privilege edits used to create a security event that appeared in the portal notification panel through SignalR. After the transactional outbox and RabbitMQ work, the privilege edit flow still writes audit and outbox records, but it no longer sends the post-commit SignalR event that `portal-web` listens for.

This fix restores real-time notification behavior for `PUT /api/privileges/{id}` while preserving the current architecture:

- MediatR domain handlers stage database changes during `PortalDbContext.SaveChangesAsync`.
- `PortalDbContext.RegisterPostCommitAction(...)` runs local SignalR pushes only after the database transaction commits.
- `IMessageBus` writes transactional outbox rows for RabbitMQ delivery to external consumers.
- RabbitMQ is not required for Portal API to notify its own connected SignalR clients.

## Problem

The privilege edit path currently raises `PrivilegeModifiedEvent` from the `Privilege` aggregate. `PrivilegeModifiedEventHandler` records an audit entry and publishes an outbox message, but it does not register a SignalR post-commit action.

The existing SignalR behavior lives in `PrivilegeChangeEventHandler`, but that handler listens for `PrivilegeChangeEvent`, which is not raised by `PUT /api/privileges/{id}`.

Current broken flow:

1. `portal-web` sends `PUT /api/privileges/{id}`.
2. `UpdatePrivilegeCommandHandler` calls `IPrivilegeService.UpdatePrivilegeAsync(...)`.
3. `PrivilegeService` mutates the `Privilege` aggregate.
4. `Privilege` raises one or more `PrivilegeModifiedEvent` instances.
5. `PrivilegeModifiedEventHandler` writes `AuditLogs` and `OutboxMessages`.
6. `OutboxPublisherBackgroundService` later publishes the outbox row to RabbitMQ.
7. No local post-commit SignalR event is sent, so `RealTimeService` never receives `SecurityEvent`.

There is also a related claim-check risk: `AuditLogsController.GetAuditLog(...)` currently allows tenant filtering to be bypassed by request header logic. Browser-controlled tenant bypass should not be part of the notification claim-check path. The correct fix is to write the audit entry under the tenant that should receive the event, then fetch it with normal tenant filtering.

## Goals

1. Restore notification panel updates after privilege metadata/risk/activation edits.
2. Preserve the outbox pattern for RabbitMQ cross-app delivery.
3. Preserve post-commit SignalR semantics so clients are not notified about rolled-back changes.
4. Keep event responsibilities clear:
   - `PrivilegeModifiedEvent`: aggregate/domain fact from `Privilege`.
   - `PrivilegeChangeEvent`: security notification/audit event with tenant, user, resource, and action context.
5. Add regression coverage proving the privilege edit path emits a SignalR security event after commit.
6. Remove browser-controlled audit tenant bypass from the claim-check path.
7. Remove cross-tenant `Clients.All` delivery for security SignalR events.

## Non-Goals

1. Do not add a RabbitMQ-to-SignalR consumer for this fix.
2. Do not extract notification handling into a separate worker.
3. Do not redesign the outbox publisher or RabbitMQ routing keys.
4. Do not change the `portal-web` notification panel UI; only remove the claim-check bypass header.
5. Do not remove either event type unless implementation work proves one is fully redundant.

## Fix Approach

Use the existing post-commit SignalR pattern and make the privilege edit use case produce a contextual security notification.

Update `PrivilegeModifiedEventHandler` so it:

1. Continues creating the immutable `AuditEntry`.
2. Continues publishing an integration event through `IMessageBus`.
3. Registers a post-commit SignalR action with `PortalDbContext.RegisterPostCommitAction(...)`.
4. Sends event type `PrivilegeChange` with a payload that includes:
   - `EventId`: the `AuditEntry.Id`
   - `Timestamp`: the `AuditEntry.Timestamp`
   - `Action`: a stable action string such as `privilege_modified`

Use `PrivilegeChange` rather than `PrivilegeModified` for the SignalR event type because `portal-web` already treats `PrivilegeChange` as a critical security notification category.

The handler must use `PortalDbContext.CurrentTenantId` for the audit entry tenant and the SignalR tenant group. The audit row should not be written under the hardcoded system tenant for this request-driven edit flow.

## Target Backend Flow

1. `PUT /api/privileges/{id}` validates authorization and step-up requirements.
2. `UpdatePrivilegeCommandHandler` delegates to `PrivilegeService.UpdatePrivilegeAsync(...)`.
3. `PrivilegeService` loads the privilege, applies changes, and calls `SaveChangesAsync`.
4. `PortalDbContext.SaveChangesAsync` saves aggregate changes, dispatches domain events, saves handler-created audit/outbox rows, commits the transaction, then runs post-commit actions.
5. `PrivilegeModifiedEventHandler` stages the tenant-scoped audit entry and outbox row, then registers a post-commit SignalR notification.
6. After commit, `SignalRRealTimeNotifier.SendSecurityEventAsync(...)` sends `SecurityEvent` to the current request tenant group. The handler can use `PortalDbContext.CurrentTenantId` for this tenant id.
7. `portal-web` receives `SecurityEvent`, extracts `EventId`, fetches `/api/AuditLogs/{eventId}` without `X-Bypass-Tenant`, and adds the audit details to `NotificationSignalStore`.

## Payload Contract

The SignalR message must remain compatible with `RealTimeService.handleSecurityEvent(...)`, which accepts both PascalCase and camelCase payloads.

Expected SignalR envelope:

```json
{
  "eventType": "PrivilegeChange",
  "payload": {
    "eventId": "audit-entry-guid",
    "timestamp": "2026-05-02T12:34:56Z",
    "action": "privilege_modified"
  }
}
```

The actual .NET anonymous object may serialize as PascalCase through SignalR. The frontend already handles both casing styles.

## Audit Claim-Check Behavior

`GET /api/AuditLogs/{id}` should apply tenant query filters. It should not trust `X-Bypass-Tenant` from the browser.

Required behavior:

- Same-tenant audit entry: return `200`.
- Other-tenant audit entry: return `404`.
- `X-Bypass-Tenant: true`: still return `404` for other-tenant audit entries.

If a global audit lookup is needed later, add a separate role-protected endpoint or policy for `GlobalAdmin`/`AuditAdmin`. Do not overload this browser claim-check endpoint.

## Testing Requirements

### Backend Unit or Integration Tests

Add coverage proving that a privilege edit causes a post-commit SignalR event:

1. Arrange a `Privilege` and update it through the same path used by `UpdatePrivilegeAsync`.
2. Use a mocked `IRealTimeNotifier`.
3. Save changes through `PortalDbContext.SaveChangesAsync`.
4. Verify `SendSecurityEventAsync(...)` is called only after the transaction completes.
5. Verify the payload includes the `AuditEntry.Id` as `EventId`.
6. Verify an audit row is persisted with action `PrivilegeModified`.
7. Verify `IMessageBus.PublishAsync(...)` is still called.

Add coverage for the audit claim-check filter:

1. Same-tenant audit entries can be fetched by ID.
2. Other-tenant audit entries return `404`.
3. `X-Bypass-Tenant: true` does not bypass tenant filtering.

Add coverage for SignalR tenant delivery:

1. `SignalRRealTimeNotifier.SendSecurityEventAsync(...)` sends to `Clients.Group(tenantId)`.
2. It does not send security events to `Clients.All`.

### Frontend Regression Check

The frontend should remove the `X-Bypass-Tenant` header from the audit claim-check request. No notification panel UI change is expected if the backend sends `EventType = "PrivilegeChange"` and includes `EventId`.

Manual verification:

1. Start Portal API, gateway, and portal-web.
2. Sign in as an admin user.
3. Open the notification panel.
4. Edit a privilege through the UI.
5. Confirm a `SecurityEvent` arrives in browser logs.
6. Confirm the audit claim-check request to `/api/AuditLogs/{eventId}` has no `X-Bypass-Tenant` header and returns 200.
7. Confirm the notification panel shows the new event.

## Acceptance Criteria

1. Editing a privilege emits a SignalR `SecurityEvent` after the database transaction commits.
2. The SignalR payload contains a valid audit `EventId`.
3. The frontend can fetch the same-tenant audit entry by ID without `X-Bypass-Tenant` and add it to the notification store.
4. Existing audit log creation for privilege edits still works.
5. Existing outbox message creation for privilege edits still works.
6. RabbitMQ publication remains unchanged.
7. No notification is sent if the privilege update fails or rolls back.
8. Security events are not broadcast to `Clients.All`.
9. Other-tenant audit entries cannot be fetched through the claim-check endpoint using `X-Bypass-Tenant`.

## Open Implementation Notes

`PrivilegeModifiedEventHandler` may currently emit multiple audit/outbox rows for a single edit because `UpdateMetadata`, `SetRiskLevel`, and `Activate`/`Deactivate` can each raise `PrivilegeModifiedEvent`. The implementation should either preserve current behavior for minimal risk or coalesce duplicate real-time notifications within one `SaveChangesAsync` operation. Coalescing is desirable but not required for this regression fix unless the notification panel shows duplicate entries for one save.

If coalescing is included, keep it local to the handler or unit-of-work and avoid changing the domain entity API in this fix.
