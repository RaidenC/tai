using System;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Domain.Interfaces;

namespace Tai.Portal.Core.Domain.Events;

/// <summary>
/// Base class for all security-related domain events.
/// Ensure consistency across real-time notifications and audit logs.
/// </summary>
public abstract record SecurityEventBase : IDomainEvent {
  public Guid EventId { get; init; } = Guid.NewGuid();
  public DateTimeOffset Timestamp { get; init; } = DateTimeOffset.UtcNow;
  public TenantId TenantId { get; init; }
  public string UserId { get; init; }
  public string? CorrelationId { get; init; }
  public string? IpAddress { get; init; }

  protected SecurityEventBase(TenantId tenantId, string userId, string? correlationId = null, string? ipAddress = null) {
    TenantId = tenantId;
    UserId = userId;
    CorrelationId = correlationId;
    IpAddress = ipAddress;
  }
}
