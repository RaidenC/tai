using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.Enums;
using Tai.Portal.Core.Infrastructure.Persistence;

namespace Tai.Portal.Api.Controllers;

public class SeedUserRequest {
  public string Email { get; set; } = string.Empty;
  public string FirstName { get; set; } = string.Empty;
  public string LastName { get; set; } = string.Empty;
  public string Password { get; set; } = "Password123!";
  public string TenantHost { get; set; } = "localhost";
  public string? Role { get; set; }
  public UserStatus? Status { get; set; }
}

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
  private readonly UserManager<ApplicationUser> _userManager;
  private readonly RoleManager<IdentityRole> _roleManager;

  public TdmController(
    PortalDbContext context,
    IServiceProvider serviceProvider,
    UserManager<ApplicationUser> userManager,
    RoleManager<IdentityRole> roleManager) {
    _context = context;
    _serviceProvider = serviceProvider;
    _userManager = userManager;
    _roleManager = roleManager;
  }

  private static readonly SemaphoreSlim _resetLock = new SemaphoreSlim(1, 1);

  [HttpPost("reset")]
  public IActionResult ResetState() {
    Console.WriteLine(" [TDM] Resetting state...");
    // SECURITY: Ensure this is only called via the Gateway with the correct secret.

    // For now, just trigger seeding to ensure data exists without risky wipes
    SeedData.Initialize(_serviceProvider, force: true);

    return Ok(new { message = "Database seeded successfully." });
  }

  [HttpPost("seed-user")]
  public async Task<IActionResult> SeedUser([FromBody] SeedUserRequest request) {
    // 1. Resolve Tenant
    var tenant = await _context.Set<Tenant>()
        .IgnoreQueryFilters()
        .FirstOrDefaultAsync(t => t.TenantHostname == request.TenantHost);

    if (tenant == null) {
      return BadRequest(new { error = $"Tenant with host '{request.TenantHost}' not found." });
    }

    // 2. Check for existing user (globally)
    var existingUser = await _userManager.Users
        .IgnoreQueryFilters()
        .FirstOrDefaultAsync(u => u.Email == request.Email);

    if (existingUser != null) {
      // If user exists, return success with current ID
      return Ok(new { message = "User already exists.", userId = existingUser.Id });
    }

    // 3. Create User
    var user = new ApplicationUser(request.Email, tenant.Id) {
      Email = request.Email,
      FirstName = request.FirstName,
      LastName = request.LastName,
      EmailConfirmed = true
    };

    // Apply requested status via Domain transitions
    var targetStatus = request.Status ?? UserStatus.Active;

    // We start at 'Created' (default in constructor)
    if (targetStatus == UserStatus.PendingApproval) {
      user.StartStaffOnboarding();
    } else if (targetStatus == UserStatus.PendingVerification) {
      user.StartCustomerOnboarding();
    } else if (targetStatus == UserStatus.Active) {
      user.StartCustomerOnboarding();
      user.ActivateAccount();
    }

    var result = await _userManager.CreateAsync(user, request.Password);
    if (!result.Succeeded) {
      return BadRequest(new { error = "Failed to create user.", details = result.Errors });
    }

    // 4. Assign Role
    if (!string.IsNullOrEmpty(request.Role)) {
      if (!await _roleManager.RoleExistsAsync(request.Role)) {
        await _roleManager.CreateAsync(new IdentityRole(request.Role));
      }
      await _userManager.AddToRoleAsync(user, request.Role);
    }

    return Ok(new { message = "User seeded successfully.", userId = user.Id });
  }
}
