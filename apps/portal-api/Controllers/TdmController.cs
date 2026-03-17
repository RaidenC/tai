using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tai.Portal.Core.Infrastructure.Persistence;

namespace Tai.Portal.Api.Controllers;

/// <summary>
/// Test Data Management (TDM) Controller.
/// 
/// JUNIOR RATIONALE: Automated tests (like Playwright) need a "Clean Slate" 
/// to run reliably. This controller provides a "Big Red Button" to wipe 
/// the database and re-seed it to a known state.
/// 
/// SECURITY: This MUST be protected by the Gateway Secret and should 
/// ideally be disabled in production.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class TdmController : ControllerBase {
  private readonly PortalDbContext _context;
  private readonly IServiceProvider _serviceProvider;

  public TdmController(PortalDbContext context, IServiceProvider serviceProvider) {
    _context = context;
    _serviceProvider = serviceProvider;
  }

  private static readonly SemaphoreSlim _resetLock = new SemaphoreSlim(1, 1);

  [HttpPost("reset")]
  public IActionResult ResetState() {
    // SECURITY: Ensure this is only called via the Gateway with the correct secret.

    // For now, just trigger seeding to ensure data exists without risky wipes
    SeedData.Initialize(_serviceProvider, force: true);

    return Ok(new { message = "Database seeded successfully." });
  }
}
