using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Abstractions;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Infrastructure.Persistence;
using Tai.Portal.Core.Application.Interfaces;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace Tai.Portal.Api;

public static class SeedData {
  private static readonly object _lock = new object();
  private static bool _seeded = false;

  public static void Initialize(IServiceProvider services) {
    if (_seeded) return;

    lock (_lock) {
      if (_seeded) return;

      using (var scope = services.CreateScope()) {
        var context = scope.ServiceProvider.GetRequiredService<PortalDbContext>();
        var tenantService = scope.ServiceProvider.GetRequiredService<ITenantService>();

        // JUNIOR RATIONALE: We enable 'Global Access' here so the seeding process 
        // can "see" all existing data across all banks. Without this, the 
        // system thinks the database is empty and tries to insert duplicate 
        // records, causing a crash.
        tenantService.SetTenant(new TenantId(Guid.Empty), isGlobalAccess: true);

        context.Database.EnsureCreated();

        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();

        // Seed Roles
        string[] roleNames = { "Admin", "User" };
        foreach (var roleName in roleNames) {
          if (!roleManager.RoleExistsAsync(roleName).GetAwaiter().GetResult()) {
            try {
              roleManager.CreateAsync(new IdentityRole(roleName)).GetAwaiter().GetResult();
            } catch (DbUpdateException) {
              // JUNIOR RATIONALE: In a multi-threaded test environment, another 
              // process might have created the role between our check and 
              // our create call. We ignore this error as the goal (the role 
              // existing) is met.
            }
          }
        }

        // Seed Tenants
        var taiTenantId = new TenantId(Guid.Parse("00000000-0000-0000-0000-000000000001"));
        if (context.Set<Tenant>().IgnoreQueryFilters().FirstOrDefault(t => t.Id == taiTenantId) is null) {
          try {
            context.Set<Tenant>().Add(new Tenant(taiTenantId, "TAI Financial Services", "localhost"));
            context.SaveChanges();
          } catch (DbUpdateException) { /* Already exists */ }
        }

        var acmeTenantId = new TenantId(Guid.Parse("00000000-0000-0000-0000-000000000002"));
        if (context.Set<Tenant>().IgnoreQueryFilters().FirstOrDefault(t => t.Id == acmeTenantId) is null) {
          try {
            context.Set<Tenant>().Add(new Tenant(acmeTenantId, "ACME Credit Union", "acme.localhost"));
            context.SaveChanges();
          } catch (DbUpdateException) { /* Already exists */ }
        }

        // Seed Users
        var taiAdminId = "00000000-0000-0000-0000-000000000010";
        var taiAdminEmail = "admin@tai.com";
        var existingTaiUser = userManager.Users.IgnoreQueryFilters().FirstOrDefault(u => u.Id == taiAdminId || u.Email == taiAdminEmail);
        if (existingTaiUser is null) {
          var user = new ApplicationUser(taiAdminEmail, taiTenantId) {
            Id = taiAdminId,
            Email = taiAdminEmail,
            EmailConfirmed = true,
          };
          try {
            userManager.CreateAsync(user, "Password123!").GetAwaiter().GetResult();
            userManager.AddToRoleAsync(user, "Admin").GetAwaiter().GetResult();
          } catch (DbUpdateException) { /* Already exists */ }
        }

        var acmeAdminId = "00000000-0000-0000-0000-000000000020";
        var acmeAdminEmail = "admin@acme.com";
        var existingAcmeUser = userManager.Users.IgnoreQueryFilters().FirstOrDefault(u => u.Id == acmeAdminId || u.Email == acmeAdminEmail);
        if (existingAcmeUser is null) {
          var user = new ApplicationUser(acmeAdminEmail, acmeTenantId) {
            Id = acmeAdminId,
            Email = acmeAdminEmail,
            EmailConfirmed = true,
          };
          try {
            userManager.CreateAsync(user, "Password123!").GetAwaiter().GetResult();
            userManager.AddToRoleAsync(user, "Admin").GetAwaiter().GetResult();
          } catch (DbUpdateException) { /* Already exists */ }
        }

        var manager = scope.ServiceProvider.GetRequiredService<IOpenIddictApplicationManager>();

        var client = manager.FindByClientIdAsync("portal-web").GetAwaiter().GetResult();
        var descriptor = new OpenIddictApplicationDescriptor {
          ClientId = "portal-web",
          DisplayName = "Portal Web Application",
          ClientType = ClientTypes.Public,
          Permissions =
            {
                      Permissions.Endpoints.Authorization,
                      Permissions.Endpoints.Logout,
                      Permissions.Endpoints.Token,
                      Permissions.Endpoints.Introspection,
                      Permissions.Prefixes.Endpoint + "userinfo",
                      Permissions.GrantTypes.AuthorizationCode,
                      Permissions.GrantTypes.RefreshToken,
                      Permissions.ResponseTypes.Code,
                      Permissions.Scopes.Email,
                      Permissions.Scopes.Profile,
                      Permissions.Scopes.Roles,
                      $"{Permissions.Prefixes.Scope}{Scopes.OpenId}"
                  },
          RedirectUris =
            {
                      new Uri("https://localhost:4200"),
                      new Uri("http://localhost:4200"),
                      new Uri("http://acme.localhost:4200")
                  },
          PostLogoutRedirectUris =
            {
                      new Uri("https://localhost:4200"),
                      new Uri("http://localhost:4200"),
                      new Uri("http://acme.localhost:4200")
                  }
        };

        try {
          if (client is null) {
            manager.CreateAsync(descriptor).GetAwaiter().GetResult();
          } else {
            manager.UpdateAsync(client, descriptor).GetAwaiter().GetResult();
          }
        } catch (OpenIddictExceptions.ConcurrencyException) {
          // JUNIOR RATIONALE: If another test or process beat us to updating 
          // the client record, it's fine. We ignore the concurrency error 
          // to prevent our startup process from crashing.
        }
      }

      _seeded = true;
    }
  }
}
