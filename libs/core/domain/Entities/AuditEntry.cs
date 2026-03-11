using System;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Domain.Interfaces;

namespace Tai.Portal.Core.Domain.Entities;

/// <summary>
/// Represents an immutable audit log entry for security and compliance tracking.
/// </summary>
public class AuditEntry : IMultiTenantEntity {
  public Guid Id { get; private set; }
  public TenantId TenantId { get; private set; }
  public TenantId AssociatedTenantId => TenantId;

  public required string UserId { get; init; }
  public required string Action { get; init; }
  public required string ResourceId { get; init; }
  public DateTimeOffset Timestamp { get; private set; }
  public string? IpAddress { get; init; }
  public string? Details { get; init; }

  // EF Core Requirement
  protected AuditEntry() { }

  [System.Diagnostics.CodeAnalysis.SetsRequiredMembers]
  public AuditEntry(
      TenantId tenantId,
      string userId,
      string action,
      string resourceId,
      string? ipAddress = null,
      string? details = null) {
    Id = Guid.NewGuid();
    TenantId = tenantId;
    UserId = userId;
    Action = action;
    ResourceId = resourceId;
    Timestamp = DateTimeOffset.UtcNow;
    IpAddress = ipAddress;
    Details = details;
  }
}
