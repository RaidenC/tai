using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using Tai.Portal.Core.Infrastructure.Persistence;

namespace Tai.Portal.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize(AuthenticationSchemes = $"{OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme},Identity.Application")]
public class AuditLogsController : ControllerBase {
  private readonly PortalDbContext _dbContext;

  public AuditLogsController(PortalDbContext dbContext) {
    _dbContext = dbContext;
  }

  /// <summary>
  /// Fetches full audit log details by ID (Claim Check pattern).
  /// Returns only the audit entry fields - not the original domain event data.
  /// Global Query Filter provides tenant isolation automatically.
  /// </summary>
  [HttpGet("{id}")]
  public async Task<IActionResult> GetAuditLog(Guid id) {
    // AuditEntry has composite key (Id, Timestamp) for partitioning
    // Use query with the unique index on Id
    var auditEntry = await _dbContext.AuditLogs
        .Where(a => a.Id == id)
        .FirstOrDefaultAsync();

    if (auditEntry == null) {
      return NotFound(new { message = "Audit log not found" });
    }

    return Ok(new {
      auditEntry.Id,
      auditEntry.TenantId,
      auditEntry.UserId,
      auditEntry.Action,
      auditEntry.ResourceId,
      auditEntry.CorrelationId,
      auditEntry.Timestamp,
      auditEntry.IpAddress,
      auditEntry.Details
    });
  }
}
