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

  [HttpPost("reset")]
  public async Task<IActionResult> ResetState() {
    // SECURITY: Ensure this is only called via the Gateway with the correct secret.
    // The GatewayTrustMiddleware already handles this globally, but we can be 
    // extra paranoid here if needed.

    // 1. Wipe the database
    // JUNIOR RATIONALE: We use raw SQL to truncate all tables in the correct order 
    // or just drop the schema and recreate it. For POC, dropping and migrating is safest.
    await _context.Database.EnsureDeletedAsync();
    await _context.Database.MigrateAsync();

    // 2. Re-seed the data
    // We reuse our existing SeedData logic.
    SeedData.Initialize(_serviceProvider, force: true);

    return Ok(new { message = "Database reset and re-seeded successfully." });
  }
}
