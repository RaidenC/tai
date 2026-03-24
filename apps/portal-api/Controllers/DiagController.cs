using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Infrastructure.Persistence;

namespace Tai.Portal.Api.Controllers;

[Route("diag")]
public class DiagController : Controller {
  private readonly IMemoryCache _cache;
  private readonly UserManager<ApplicationUser> _userManager;
  private readonly PortalDbContext _dbContext;

  public DiagController(IMemoryCache cache, UserManager<ApplicationUser> userManager, PortalDbContext dbContext) {
    _cache = cache;
    _userManager = userManager;
    _dbContext = dbContext;
  }

  [HttpGet("headers")]
  public IActionResult GetHeaders() {
    var headers = Request.Headers.ToDictionary(h => h.Key, h => h.Value.ToString());
    var info = new {
      Host = Request.Host.ToString(),
      PathBase = Request.PathBase.ToString(),
      Scheme = Request.Scheme,
      Headers = headers
    };
    return Ok(info);
  }

  /// <summary>
  /// Diagnostic endpoint to retrieve the current OTP for a user.
  /// ONLY FOR POC/E2E TESTING.
  /// </summary>
  [HttpGet("otp/{userId}")]
  public IActionResult GetOtp(string userId) {
    var cacheKey = $"OTP_VERIFICATION_{userId}";
    if (_cache.TryGetValue(cacheKey, out string? code)) {
      return Ok(new { UserId = userId, Code = code });
    }
    return NotFound(new { Message = "No OTP found for this user." });
  }

  /// <summary>
  /// Diagnostic endpoint to retrieve the current OTP for a user by email.
  /// ONLY FOR POC/E2E TESTING.
  /// </summary>
  [HttpGet("otp-by-email")]
  public async Task<IActionResult> GetOtpByEmail([FromQuery] string email) {
    var user = await _userManager.FindByEmailAsync(email);
    if (user == null) {
      return NotFound(new { Message = "User not found." });
    }

    var cacheKey = $"OTP_VERIFICATION_{user.Id}";
    if (_cache.TryGetValue(cacheKey, out string? code)) {
      return Ok(new { UserId = user.Id, Code = code });
    }
    return NotFound(new { Message = "No OTP found for this user." });
  }

  /// <summary>
  /// Diagnostic endpoint to retrieve audit logs for a specific resource.
  /// ONLY FOR POC/E2E TESTING.
  /// </summary>
  [HttpGet("audit-logs/{resourceId}")]
  public async Task<IActionResult> GetAuditLogs(string resourceId) {
    var logs = await _dbContext.AuditLogs
        .IgnoreQueryFilters()
        .Where(l => l.ResourceId == resourceId)
        .OrderByDescending(l => l.Timestamp)
        .ToListAsync();

    return Ok(logs);
  }
}
