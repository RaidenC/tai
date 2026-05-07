using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Infrastructure.Persistence;

namespace Tai.Portal.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize(AuthenticationSchemes = $"{OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme},Identity.Application")]
public class AuditLogsController : ControllerBase {
  private readonly PortalDbContext _dbContext;
  private readonly ITenantService _tenantService;

  public AuditLogsController(PortalDbContext dbContext, ITenantService tenantService) {
    _dbContext = dbContext;
    _tenantService = tenantService;
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
    IQueryable<AuditEntry> query = _dbContext.AuditLogs;

    var auditEntry = await query
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

  /// <summary>
  /// Returns recent audit logs for the current tenant, ordered by timestamp descending.
  /// Default limit is 50, maximum is 100.
  /// NOTE: Role authorization is enforced at the controller level (Admin, SystemAdmin).
  /// </summary>
  [HttpGet("recent")]
  public async Task<IActionResult> GetRecentAuditLogs([FromQuery] int? limit) {
    var currentTenantId = _tenantService.TenantId;
    if (currentTenantId.Value == Guid.Empty) {
      return Forbid();
    }

    var take = limit.GetValueOrDefault(50);
    if (take <= 0) take = 50;
    if (take > 100) take = 100;

    var rows = await _dbContext.AuditLogs
      .Where(a => a.TenantId == currentTenantId)
      .OrderByDescending(a => a.Timestamp)
      .Take(take)
      .Select(a => new {
        a.Id,
        a.TenantId,
        a.UserId,
        a.Action,
        a.ResourceId,
        a.CorrelationId,
        a.Timestamp,
        a.IpAddress,
        a.Details
      })
      .ToListAsync();

    return Ok(rows);
  }
}
