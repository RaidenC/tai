using System.Reflection;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Tai.Portal.Core.Domain.Interfaces;
using Tai.Portal.Core.Domain.ValueObjects;

namespace Tai.Portal.Core.Infrastructure.Persistence.Interceptors;

/// <summary>
/// This Interceptor is a "Silent Guard." It watches whenever you save data.
/// 
/// JUNIOR RATIONALE: Developers are human and might forget to set the TenantId 
/// on a new record. This interceptor catches that. It automatically stamps 
/// every new record with the current Tenant's ID before it hits the database.
/// It's "Secure by Default."
/// </summary>
public class TenantInterceptor : SaveChangesInterceptor {
  public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result) {
    if (eventData?.Context != null) {
      InjectTenantId(eventData.Context);
    }
    return base.SavingChanges(eventData!, result);
  }

  public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default) {
    if (eventData?.Context != null) {
      InjectTenantId(eventData.Context);
    }
    return base.SavingChangesAsync(eventData!, result, cancellationToken);
  }

  private static void InjectTenantId(DbContext? context) {
    if (context == null) {
      return;
    }

    // 1. Get the current tenant ID from the context (provided by ITenantService)
    var currentTenantIdProperty = context.GetType().GetProperty("CurrentTenantId");
    if (currentTenantIdProperty == null) {
      return;
    }

    var tenantIdObj = currentTenantIdProperty.GetValue(context);
    if (tenantIdObj == null) {
      return;
    }

    var currentTenantId = (TenantId)tenantIdObj;
    // If we are in a 'Global' mode (no specific tenant), we don't inject anything
    if (currentTenantId.Value == Guid.Empty) {
      return;
    }

    // 2. Find all new records being added that need a TenantId
    var entries = context.ChangeTracker.Entries<IMultiTenantEntity>()
        .Where(e => e.State == EntityState.Added);

    foreach (var entry in entries) {
      // 3. Automatically set the TenantId via Reflection
      // JUNIOR RATIONALE: We use reflection to set the field directly because 
      // the 'TenantId' property is often "init-only" for safety. 
      // Reflection allows us to "reach inside" and set it anyway.

      var tenantIdProperty = entry.Entity.GetType().GetProperty("TenantId", BindingFlags.Public | BindingFlags.Instance | BindingFlags.NonPublic);

      if (tenantIdProperty != null && tenantIdProperty.CanWrite) {
        tenantIdProperty.SetValue(entry.Entity, currentTenantId);
      } else {
        // Fallback: Look for common C# compiler backing field names
        var field = entry.Entity.GetType().GetField("<TenantId>k__BackingField", BindingFlags.NonPublic | BindingFlags.Instance)
                    ?? entry.Entity.GetType().GetField("_tenantId", BindingFlags.NonPublic | BindingFlags.Instance);

        if (field != null) {
          field.SetValue(entry.Entity, currentTenantId);
        }
      }
    }
  }
}
