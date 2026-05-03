using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Tai.Portal.Core.Domain.Entities;

namespace Tai.Portal.Api.Services;

/// <summary>
/// Adds tenant context to the Identity application cookie principal.
/// </summary>
public class TenantUserClaimsPrincipalFactory : UserClaimsPrincipalFactory<ApplicationUser, IdentityRole> {
  public TenantUserClaimsPrincipalFactory(
      UserManager<ApplicationUser> userManager,
      RoleManager<IdentityRole> roleManager,
      IOptions<IdentityOptions> optionsAccessor)
      : base(userManager, roleManager, optionsAccessor) {
  }

  protected override async Task<ClaimsIdentity> GenerateClaimsAsync(ApplicationUser user) {
    var identity = await base.GenerateClaimsAsync(user);
    identity.AddClaim(new Claim("tenant_id", user.TenantId.Value.ToString()));
    return identity;
  }
}
