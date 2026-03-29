using Tai.Portal.Core.Domain.ValueObjects;

namespace Tai.Portal.Core.Domain.Events;

/// <summary>
/// Triggered when a user-specific security setting is modified (e.g., disabling MFA).
/// </summary>
public record SecuritySettingChangeEvent : SecurityEventBase {
  public string SettingName { get; init; }
  public string Details { get; init; }
  public string ResourceId { get; init; }

  public SecuritySettingChangeEvent(
      TenantId tenantId,
      string userId,
      string settingName,
      string details,
      string resourceId,
      string? correlationId = null,
      string? ipAddress = null)
      : base(tenantId, userId, correlationId, ipAddress) {
    SettingName = settingName;
    Details = details;
    ResourceId = resourceId;
  }
}
