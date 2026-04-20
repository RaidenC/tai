using System;

namespace Tai.Portal.Core.Infrastructure.Persistence.Entities;

// JUNIOR RATIONALE (Outbox Entity):
// This is an INFRASTRUCTURE concern, not a domain concept — that's why it
// lives under Infrastructure/Persistence/Entities, not Domain/Entities.
// Aggregates have no awareness of "outbox-ness." The pattern is the price
// you pay for atomicity between DB writes and broker publishes.
public class OutboxMessage {
  // PK as Guid, not identity int: stable across DB recovery / dump-restore,
  // and used directly as RabbitMQ MessageId so Stage-2 consumers can dedup.
  public Guid Id { get; set; }

  // Fully-qualified CLR type name (AssemblyQualifiedName preferred).
  // Used by the publisher to derive a routing key, and by future
  // consumers as an envelope hint.
  public string EventType { get; set; } = null!;

  // JSONB column. Queryable in Postgres (e.g. payload->>'userId'),
  // validated as JSON at write time, compact on disk.
  public string Payload { get; set; } = null!;

  // Set when added to the DbSet, INSIDE the originating transaction —
  // so it's the transaction-commit timeline, not the publish timeline.
  public DateTimeOffset OccurredAt { get; set; }

  // null = unprocessed. Set after broker publisher confirm.
  public DateTimeOffset? ProcessedAt { get; set; }

  public int RetryCount { get; set; }

  // Last error message; nulled out after a successful attempt.
  public string? Error { get; set; }

  // Optional, ties back to the originating request/user action for tracing.
  public string? CorrelationId { get; set; }
}
