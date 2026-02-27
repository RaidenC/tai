using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Infrastructure.Persistence;
using OpenIddict.Validation.AspNetCore;

namespace Tai.Portal.Api.Controllers;

[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
[Route("api/[controller]")]
public class TenantDataController : Controller {
  private readonly PortalDbContext _context;

  public TenantDataController(PortalDbContext context) {
    _context = context;
  }

  [HttpGet("tenants/{id}")]
  public async Task<IActionResult> GetTenant(Guid id) {
    var tenantId = new TenantId(id);
    
    // JUNIOR RATIONALE: Because of the Global Query Filter in PortalDbContext,
    // this query will automatically include "WHERE Id = @CurrentTenantId".
    // If the user tries to access a different tenant's ID, this will return null.
    var tenant = await _context.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId);

    if (tenant == null) {
      // We return 404 to avoid leaking whether the ID exists in another tenant.
      return NotFound();
    }

    return Ok(new {
      tenant.Id,
      tenant.Name,
      tenant.TenantHostname
    });
  }

  [HttpGet("users/{id}")]
  public async Task<IActionResult> GetUser(string id) {
    // JUNIOR RATIONALE: Similarly, the ApplicationUser entity is also filtered.
    var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id);

    if (user == null) {
      return NotFound();
    }

    return Ok(new {
      user.Id,
      user.UserName,
      user.Email,
      user.TenantId
    });
  }
}
