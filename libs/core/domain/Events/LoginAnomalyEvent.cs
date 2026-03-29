using Tai.Portal.Core.Domain.ValueObjects;

namespace Tai.Portal.Core.Domain.Events;

/// <summary>
/// Triggered when a login anomaly is detected (e.g., failed MFA, unrecognized IP).
/// </summary>
public record LoginAnomalyEvent : SecurityEventBase {
  public string Reason { get; init; }
  public string Details { get; init; }

  public LoginAnomalyEvent(
      TenantId tenantId,
      string userId,
      string reason,
      string details,
      string? ipAddress = null,
      string? correlationId = null)
      : base(tenantId, userId, correlationId, ipAddress) {
    Reason = reason;
    Details = details;
  }
}
