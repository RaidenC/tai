using Tai.Portal.Core.Domain.ValueObjects;

namespace Tai.Portal.Core.Domain.Events;

/// <summary>
/// Triggered when a sensitive privilege is modified or JIT elevation is requested/approved.
/// </summary>
public record PrivilegeChangeEvent : SecurityEventBase {
  public string Action { get; init; }
  public string Details { get; init; }
  public string ResourceId { get; init; }

  public PrivilegeChangeEvent(
      TenantId tenantId,
      string userId,
      string action,
      string details,
      string resourceId,
      string? correlationId = null,
      string? ipAddress = null)
      : base(tenantId, userId, correlationId, ipAddress) {
    Action = action;
    Details = details;
    ResourceId = resourceId;
  }
}
