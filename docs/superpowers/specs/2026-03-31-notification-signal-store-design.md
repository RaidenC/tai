# Design: NotificationSignalStore (Phase 6)

## Overview

Implement Angular SignalStore for managing real-time security events with idempotency. Uses `@ngrx/signals` to manage the incoming stream of security events from SignalR.

## Architecture

### Data Flow
```
RealTimeService (SignalR)
    ↓ (receives event via Claim Check)
NotificationSignalStore
    ↓ (deduplicates via eventId cache)
    ↓ (adds to buffer)
Components subscribe to store signals
    ↓
Data Table / Toast consume events
```

### Store Location
- `apps/portal-web/src/app/store/notification-signal.store.ts`

## Implementation Details

### NotificationSignalStore

Using `@ngrx/signals` with these signals and methods:

```typescript
// Signals
eventBuffer: Signal<AuditLogDetails[]>       // Max 50 recent events
connectionStatus: Signal<HubConnectionState> // SignalR state
latestEvent: Signal<AuditLogDetails | null>  // Most recent event

// Methods
addEvent(event: AuditLogDetails): void       // Add with dedup
removeEvent(eventId: string): void           // Remove from buffer (dismiss toast)
clearBuffer(): void                          // Clear all events
```

### Idempotency Logic

- `seenEventIds`: `Set<string>` with max 1000 entries
- On `addEvent()`:
  1. Check if `event.id` in `seenEventIds` → if yes, skip (duplicate)
  2. If no → add to set, add event to buffer
  3. If buffer > 50 → remove oldest event
  4. If set > 1000 → clear oldest entries (FIFO)

### Constants
```typescript
MAX_BUFFER_SIZE = 50
MAX_IDEMPOTENCY_CACHE = 1000
```

## Integration

### RealTimeService Changes
- Import `NotificationSignalStore`
- Replace `BehaviorSubject` with store's `addEvent()` method
- Subscribe to store signals instead of BehaviorSubject

### Component Usage
```typescript
// In component
private store = inject(NotificationSignalStore);

readonly events = this.store.eventBuffer;
readonly latest = this.store.latestEvent;

// In template
@for (event of events(); track event.id) {
  <app-toast [event]="event" (dismiss)="store.removeEvent(event.id)" />
}
```

## Testing

### Vitest Tests
1. **Deduplication**: Add same event twice → only one in buffer
2. **Buffer size**: Add 60 events → buffer contains last 50
3. **Idempotency cache**: Add 1001 unique events → cache has 1000 (oldest evicted)
4. **Remove event**: Remove event → buffer updated, cache preserved
5. **Clear buffer**: Clear all → buffer empty, cache cleared

## Acceptance Criteria

- [ ] Store implemented with @ngrx/signals
- [ ] Idempotency prevents duplicate event processing
- [ ] Buffer limited to 50 events
- [ ] Idempotency cache limited to 1000 entries
- [ ] RealTimeService integrated with store
- [ ] Vitest tests pass