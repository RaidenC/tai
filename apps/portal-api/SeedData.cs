using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.EntityFrameworkCore.Infrastructure;
using OpenIddict.Abstractions;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Infrastructure.Persistence;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Domain.Enums;
using static OpenIddict.Abstractions.OpenIddictConstants;
using System.Data;

namespace Tai.Portal.Api;

public static class SeedData {
  private static readonly object _lock = new object();
  private static bool _seeded = false;

  public static void Initialize(IServiceProvider services, bool force = false) {
    try {
      if (_seeded && !force) return;

      lock (_lock) {
        if (_seeded && !force) return;

        Console.WriteLine(" [SEED] Starting initialization...");
        var totalSw = System.Diagnostics.Stopwatch.StartNew();

        using (var scope = services.CreateScope()) {
          var context = scope.ServiceProvider.GetRequiredService<PortalDbContext>();

          var databaseCreator = context.Database.GetService<IDatabaseCreator>() as IRelationalDatabaseCreator;
          if (databaseCreator != null) {
            if (!databaseCreator.Exists()) {
              Console.WriteLine(" [SEED] Database does not exist. Creating...");
              databaseCreator.Create();
            }
          }

          var connection = context.Database.GetDbConnection();
          var wasOpen = connection.State == ConnectionState.Open;
          if (!wasOpen) connection.Open();

          try {
            using (var command = connection.CreateCommand()) {
              command.CommandText = "SELECT pg_advisory_lock(424242);";
              command.ExecuteNonQuery();
              Console.WriteLine(" [SEED] Advisory lock acquired.");
            }

            var tenantService = scope.ServiceProvider.GetRequiredService<ITenantService>();
            tenantService.SetTenant(new TenantId(Guid.Empty), isGlobalAccess: true);

            try {
              var pending = context.Database.GetPendingMigrations();
              if (pending.Any()) {
                Console.WriteLine($" [SEED] Applying {pending.Count()} migrations...");
                var sw = System.Diagnostics.Stopwatch.StartNew();
                context.Database.Migrate();
                Console.WriteLine($" [SEED] Migrations applied in {sw.ElapsedMilliseconds}ms");
              }
            } catch (Npgsql.PostgresException ex) when (ex.SqlState == "42P07" || ex.SqlState == "42701") {
              // Ignore table/column already exists
              Console.WriteLine($" [SEED] Ignoring Postgres error: {ex.Message} (State: {ex.SqlState})");
            }

            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();

            // Seed Roles
            Console.WriteLine(" [SEED] Seeding roles...");
            var rolesSw = System.Diagnostics.Stopwatch.StartNew();
            string[] roleNames = { "Admin", "User" };
            foreach (var roleName in roleNames) {
              if (!roleManager.RoleExistsAsync(roleName).GetAwaiter().GetResult()) {
                try {
                  roleManager.CreateAsync(new IdentityRole(roleName)).GetAwaiter().GetResult();
                } catch (DbUpdateException) { /* Already exists */ }
              }
            }
            Console.WriteLine($" [SEED] Roles checked/seeded in {rolesSw.ElapsedMilliseconds}ms");

            // Seed Tenants
            Console.WriteLine(" [SEED] Seeding tenants...");
            var tenantsSw = System.Diagnostics.Stopwatch.StartNew();
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
            Console.WriteLine($" [SEED] Tenants checked/seeded in {tenantsSw.ElapsedMilliseconds}ms");

            // Seed Privileges (System Catalog)
            Console.WriteLine(" [SEED] Seeding privileges...");
            var privsSw = System.Diagnostics.Stopwatch.StartNew();
            var systemPrivileges = new List<Privilege> {
              // 1. Standard CRUD
              new Privilege("Portal.Users.Read", "View user accounts and profiles", "Portal", RiskLevel.Low, new JitSettings()),
              new Privilege("Portal.Users.Create", "Onboard new users to the institution", "Portal", RiskLevel.Medium, new JitSettings()),
              new Privilege("Portal.Users.Update", "Modify existing user account details", "Portal", RiskLevel.Medium, new JitSettings()),
              new Privilege("Portal.Users.Delete", "Permanently remove user accounts", "Portal", RiskLevel.High, new JitSettings()),

              // 2. Module/Tenant Boundary Testing
              new Privilege("DocViewer.Fax.Send", "Send outbound faxes through the DocViewer app", "DocViewer", RiskLevel.Medium, new JitSettings()),
              new Privilege("LoanOrigination.Application.Approve", "Final approval for loan applications", "LoanOrigination", RiskLevel.High, new JitSettings(TimeSpan.FromHours(2), true, true)),

              // 3. Just-In-Time (JIT) & High-Risk Security Testing
              new Privilege("Wires.Transfer.Approve", "Authorized approval for high-value wire transfers", "Wires", RiskLevel.High, new JitSettings(TimeSpan.FromMinutes(15), false, true)),
              new Privilege("System.Settings.Modify", "Modify global platform configuration settings", "System", RiskLevel.Critical, new JitSettings(TimeSpan.FromHours(1), true, true)),

              // 4. Edge Cases
              new Privilege("Portal.Users.ReallyLongNameThatMightBreakTheUILayout", "Test UI truncation logic", "Portal", RiskLevel.Low, new JitSettings()),
              new Privilege("A.B.C.D.E.F.G.H.I.J.K", "Test extreme hierarchical depth support", "System", RiskLevel.Low, new JitSettings()),
              new Privilege("LegacyApp.OldFeature.Read", "Deprecated feature privilege for testing inactive state", "LegacyApp", RiskLevel.Low, new JitSettings())
            };

            // Set Supported Scopes for seed data
            foreach (var p in systemPrivileges) {
              p.AddSupportedScope(PrivilegeScope.Global);
              p.AddSupportedScope(PrivilegeScope.Tenant);
              if (p.Name.StartsWith("Portal.Users")) p.AddSupportedScope(PrivilegeScope.Self);
            }

            // Deactivate the Legacy privilege
            systemPrivileges.First(p => p.Name == "LegacyApp.OldFeature.Read").Deactivate();

            foreach (var privilege in systemPrivileges) {
              if (!context.Privileges.IgnoreQueryFilters().Any(p => p.Name == privilege.Name)) {
                try {
                  context.Privileges.Add(privilege);
                  Console.WriteLine($" [SEED] Added privilege: {privilege.Name}");
                } catch (DbUpdateException) { /* Already exists */ }
              } else {
                Console.WriteLine($" [SEED] Privilege already exists: {privilege.Name}");
              }
            }
            int saved = context.SaveChanges();
            Console.WriteLine($" [SEED] Privileges checked/seeded in {privsSw.ElapsedMilliseconds}ms. Saved {saved} changes.");

            // Seed Users
            Console.WriteLine(" [SEED] Seeding users...");
            var usersSw = System.Diagnostics.Stopwatch.StartNew();

            // Set TAI context for TAI users
            tenantService.SetTenant(taiTenantId, isGlobalAccess: true);

            var taiAdminId = "00000000-0000-0000-0000-000000000010";
            var taiAdminEmail = "admin@tai.com";
            var existingTaiUser = userManager.Users!.IgnoreQueryFilters().FirstOrDefault(u => u.Id == taiAdminId || u.Email == taiAdminEmail);
            if (existingTaiUser is null) {
              var user = new ApplicationUser(taiAdminEmail, taiTenantId) {
                Id = taiAdminId,
                Email = taiAdminEmail,
                EmailConfirmed = true,
                FirstName = "TAI",
                LastName = "Admin"
              };
              try {
                userManager.CreateAsync(user, "Password123!").GetAwaiter().GetResult();
                userManager.AddToRoleAsync(user, "Admin").GetAwaiter().GetResult();
              } catch (DbUpdateException) { /* Already exists */ }
            }

            // Seed additional TAI users for pagination (Optimized: check count first)
            var taiUserCount = userManager.Users!.IgnoreQueryFilters().Count(u => u.TenantId == taiTenantId && u.Email.EndsWith("@tai.com") && u.Email != taiAdminEmail);
            if (taiUserCount < 25) {
              Console.WriteLine($" [SEED] Seeding {25 - taiUserCount} more TAI users...");
              for (int i = 1; i <= 25; i++) {
                var email = $"user{i}@tai.com";
                if (userManager.Users!.IgnoreQueryFilters().FirstOrDefault(u => u.Email == email) is null) {
                  var user = new ApplicationUser(email, taiTenantId) {
                    Email = email,
                    EmailConfirmed = true,
                    FirstName = "TAI",
                    LastName = $"User {i}"
                  };
                  userManager.CreateAsync(user, "Password123!").GetAwaiter().GetResult();
                }
              }
            }

            var acmeAdminId = "00000000-0000-0000-0000-000000000020";
            var acmeAdminEmail = "admin@acme.com";

            // Set ACME context for ACME users
            tenantService.SetTenant(acmeTenantId, isGlobalAccess: true);

            var existingAcmeUser = userManager.Users!.IgnoreQueryFilters().FirstOrDefault(u => u.Id == acmeAdminId || u.Email == acmeAdminEmail);
            if (existingAcmeUser is null) {
              var user = new ApplicationUser(acmeAdminEmail, acmeTenantId) {
                Id = acmeAdminId,
                Email = acmeAdminEmail,
                EmailConfirmed = true,
                FirstName = "ACME",
                LastName = "Admin"
              };
              try {
                userManager.CreateAsync(user, "Password123!").GetAwaiter().GetResult();
                userManager.AddToRoleAsync(user, "Admin").GetAwaiter().GetResult();
              } catch (DbUpdateException) { /* Already exists */ }
            }

            // Seed additional ACME users for pagination (Optimized: check count first)
            var acmeUserCount = userManager.Users!.IgnoreQueryFilters().Count(u => u.TenantId == acmeTenantId && u.Email.EndsWith("@acme.com") && u.Email != acmeAdminEmail);
            if (acmeUserCount < 25) {
              Console.WriteLine($" [SEED] Seeding {25 - acmeUserCount} more ACME users...");
              for (int i = 1; i <= 25; i++) {
                var email = $"user{i}@acme.com";
                if (userManager.Users!.IgnoreQueryFilters().FirstOrDefault(u => u.Email == email) is null) {
                  var user = new ApplicationUser(email, acmeTenantId) {
                    Email = email,
                    EmailConfirmed = true,
                    FirstName = "ACME",
                    LastName = $"User {i}"
                  };
                  userManager.CreateAsync(user, "Password123!").GetAwaiter().GetResult();
                }
              }
            }
            Console.WriteLine($" [SEED] Users checked/seeded in {usersSw.ElapsedMilliseconds}ms");

            Console.WriteLine(" [SEED] Seeding OpenIddict...");
            var oidcSw = System.Diagnostics.Stopwatch.StartNew();
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
                          new Uri("http://acme.localhost:4200"),
                          new Uri("http://localhost:4201")
                      },
              PostLogoutRedirectUris =
                {
                          new Uri("https://localhost:4200"),
                          new Uri("http://localhost:4200"),
                          new Uri("http://acme.localhost:4200"),
                          new Uri("http://localhost:4201")
                      }
            };

            try {
              if (client is null) {
                manager.CreateAsync(descriptor).GetAwaiter().GetResult();
              } else {
                manager.UpdateAsync(client, descriptor).GetAwaiter().GetResult();
              }
            } catch (OpenIddictExceptions.ConcurrencyException) {
              // Concurrency is fine
            }

            // Register DocViewer client for OIDC authentication
            var docviewerClient = manager.FindByClientIdAsync("docviewer").GetAwaiter().GetResult();
            var docviewerDescriptor = new OpenIddictApplicationDescriptor {
              ClientId = "docviewer",
              DisplayName = "DocViewer Application",
              ClientType = ClientTypes.Public,
              Permissions =
                {
                    Permissions.Endpoints.Authorization,
                    Permissions.Endpoints.Logout,
                    Permissions.Endpoints.Token,
                    Permissions.GrantTypes.AuthorizationCode,
                    Permissions.GrantTypes.RefreshToken,
                    Permissions.ResponseTypes.Code,
                    Permissions.Scopes.Email,
                    Permissions.Scopes.Profile,
                    Permissions.Scopes.Roles,
                },
              RedirectUris =
                {
                    new Uri("http://localhost:5173"),
                    new Uri("http://localhost:5173/callback"),
                    new Uri("http://localhost:5173/silent-renew"),
                },
              PostLogoutRedirectUris =
                {
                    new Uri("http://localhost:5173"),
                }
            };

            try {
              if (docviewerClient is null) {
                manager.CreateAsync(docviewerDescriptor).GetAwaiter().GetResult();
                Console.WriteLine(" [SEED] Registered docviewer OIDC client");
              } else {
                manager.UpdateAsync(docviewerClient, docviewerDescriptor).GetAwaiter().GetResult();
                Console.WriteLine(" [SEED] Updated docviewer OIDC client");
              }
            } catch (OpenIddictExceptions.ConcurrencyException) {
              // Concurrency is fine
            }

            Console.WriteLine($" [SEED] OpenIddict checked/updated in {oidcSw.ElapsedMilliseconds}ms");

            using (var command = connection.CreateCommand()) {
              command.CommandText = "SELECT pg_advisory_unlock(424242);";
              command.ExecuteNonQuery();
              Console.WriteLine(" [SEED] Released advisory lock.");
            }
          } finally {
            if (!wasOpen) connection.Close();
          }
        }

        _seeded = true;
        Console.WriteLine($" [SEED] Seeding completed successfully in {totalSw.ElapsedMilliseconds}ms");
      }
    } catch (Exception ex) {
      Console.WriteLine($" [SEED] FATAL ERROR during seeding: {ex.Message}");
      Console.WriteLine(ex.StackTrace);
      throw;
    }
  }
}
