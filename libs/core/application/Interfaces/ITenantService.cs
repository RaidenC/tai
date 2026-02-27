using Tai.Portal.Core.Domain.ValueObjects;

namespace Tai.Portal.Core.Application.Interfaces;

/// <summary>
/// This service is the "Source of Truth" for multi-tenancy during a single request.
/// 
/// JUNIOR RATIONALE: Think of this as the system's "Context." Once the Middleware 
/// figures out who the tenant is, it stores that ID here. Then, the rest of the 
/// app (Database, Services) can just ask this service: "Who is the current bank?"
/// </summary>
public interface ITenantService {
  /// <summary>
  /// The ID of the currently active bank/tenant.
  /// </summary>
  TenantId TenantId { get; }

  /// <summary>
  /// The "Master Key" flag. If true, the system allows seeing data from ALL tenants.
  /// 
  /// JUNIOR RATIONALE: This is a powerful and dangerous tool. It's only for 
  /// System Admins who need to run global reports. It bypasses the safety filters.
  /// </summary>
  bool IsGlobalAccess { get; }

  /// <summary>
  /// Sets the identity of the current tenant.
  /// </summary>
  void SetTenant(TenantId tenantId, bool isGlobalAccess = false);
}
