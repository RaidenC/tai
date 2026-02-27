using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Domain.ValueObjects;

namespace Tai.Portal.Core.Application.Services;

/// <summary>
/// Default implementation of ITenantService.
/// </summary>
public class TenantService : ITenantService {
  public TenantId TenantId { get; private set; }
  public bool IsGlobalAccess { get; private set; }

  public void SetTenant(TenantId tenantId, bool isGlobalAccess = false) {
    TenantId = tenantId;
    IsGlobalAccess = isGlobalAccess;
  }
}
