using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Infrastructure.Persistence;

namespace Tai.Portal.Core.Infrastructure.Middleware;

/// <summary>
/// This Middleware is the "Front Door" security check for every web request.
/// It looks at the URL (Host) and determines which bank the user belongs to.
/// </summary>
public class TenantResolutionMiddleware {
  private readonly RequestDelegate _next;
  private readonly IMemoryCache _cache;

  public TenantResolutionMiddleware(RequestDelegate next, IMemoryCache cache) {
    _next = next;
    _cache = cache;
  }

  public async Task InvokeAsync(HttpContext context, ITenantService tenantService, PortalDbContext dbContext) {
    // 1. Get the domain name (e.g., 'acme.localhost')
    // JUNIOR RATIONALE: We use the Host header which has been corrected by 
    // the ForwardedHeaders middleware. 
    string host = context.Request.Host.Host.ToLowerInvariant();

    if (!string.IsNullOrEmpty(host)) {
      // 2. Look up which Tenant ID matches this domain name
      var tenantId = await GetTenantIdFromHostAsync(host, dbContext);

      Console.WriteLine($"[TENANT] Resolving host: '{host}' -> TenantId: {(tenantId.HasValue ? tenantId.Value : "NOT FOUND")}");

      if (tenantId.HasValue) {
        // 3. Store the result in our scoped service for use in this request
        tenantService.SetTenant(tenantId.Value);
      }
    }

    // 4. Continue to the next part of the app
    await _next(context);
  }

  private async Task<TenantId?> GetTenantIdFromHostAsync(string host, PortalDbContext dbContext) {
    // JUNIOR RATIONALE: Database lookups are slow. We use a "Cache" (Memory) 
    // to remember hostnames. It's like checking your pocket notebook 
    // instead of driving to the Library every time.
    var cacheKey = $"tenant_host_{host}";

    if (!_cache.TryGetValue(cacheKey, out TenantId? tenantId)) {
      // Cache miss: We have to ask the Database
      var tenant = await dbContext.Tenants
          .AsNoTracking()
          .IgnoreQueryFilters() // Mandatory: We don't know the tenant yet!
          .FirstOrDefaultAsync(t => t.TenantHostname == host);

      if (tenant != null) {
        tenantId = tenant.Id;
        // Save it in the notebook for 15 minutes
        _cache.Set(cacheKey, tenantId, TimeSpan.FromMinutes(15));
      }
    }

    return tenantId;
  }
}
