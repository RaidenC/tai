using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Application.Models;
using Tai.Portal.Core.Application.UseCases.Users;
using Tai.Portal.Core.Application.Constants;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.ValueObjects;
using Microsoft.AspNetCore.Identity;
using Xunit;

namespace Tai.Portal.Api.IntegrationTests;

public class UsersApiTests : IClassFixture<WebApplicationFactory<Program>> {
  private readonly WebApplicationFactory<Program> _factory;

  private readonly Guid TaiTenantId = Guid.Parse("00000000-0000-0000-0000-000000000001");
  private readonly Guid AcmeTenantId = Guid.Parse("00000000-0000-0000-0000-000000000002");
  private const string TaiAdminId = "00000000-0000-0000-0000-000000000010";

  public UsersApiTests(WebApplicationFactory<Program> factory) {
    _factory = factory;
  }
  private WebApplicationFactory<Program> CreateFactoryWithMockAuth(string userId) {
    return _factory.WithWebHostBuilder(builder => {
      builder.ConfigureTestServices(services => {
        // Add a mock authentication handler
        const string scheme = "TestAuth";
        services.AddAuthentication(options => {
          options.DefaultAuthenticateScheme = scheme;
          options.DefaultChallengeScheme = scheme;
          options.DefaultScheme = scheme;
        })
        .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(scheme, options => { });

        // Override the ApiPolicy to use our test scheme
        services.AddAuthorization(options => {
          options.AddPolicy(AuthorizationPolicies.ApiPolicy, policy => {
            policy.AddAuthenticationSchemes(scheme);
            policy.RequireAuthenticatedUser();
          });
        });

        services.AddSingleton(new TestUserContext { UserId = userId });
        services.AddSingleton<IAuthorizationHandler, AllowAnonymousAuthorizationHandler>();
        services.AddSingleton<IAuthorizationService, BypassAuthorizationService>();
      });
    });
  }

  [Fact]
  public async Task GetUsers_ReturnsOnlyUsersFromOwnTenant() {
    // Arrange
    var factory = CreateFactoryWithMockAuth(TaiAdminId);
    var client = factory.CreateClient(new WebApplicationFactoryClientOptions {
      BaseAddress = new Uri("http://localhost/")
    });
    client.DefaultRequestHeaders.Add("X-Gateway-Secret", Environment.GetEnvironmentVariable("GATEWAY_SECRET") ?? "portal-poc-secret-2026");

    // 1. Seed users for both tenants
    using (var scope = factory.Services.CreateScope()) {
      var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
      var tenantService = scope.ServiceProvider.GetRequiredService<ITenantService>();

      // We need to bypass the tenant filter to seed data across tenants
      tenantService.SetTenant(new TenantId(Guid.Empty), isGlobalAccess: true);

      // Add one more TAI user
      var taiUser = new ApplicationUser($"tai_user_{Guid.NewGuid()}@tai.com", new TenantId(TaiTenantId)) { EmailConfirmed = true };
      await userManager.CreateAsync(taiUser, "Password123!");

      // Add an ACME user
      var acmeUser = new ApplicationUser($"acme_user_{Guid.NewGuid()}@acme.com", new TenantId(AcmeTenantId)) { EmailConfirmed = true };
      await userManager.CreateAsync(acmeUser, "Password123!");
    }

    // Act
    var response = await client.GetAsync("/api/Users");

    // Assert
    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    var result = await response.Content.ReadFromJsonAsync<PaginatedList<UserDto>>();

    Assert.NotNull(result);
    var users = result.Items;
    Assert.NotEmpty(users);

    // Should see TAI Admin (pre-seeded) + the new TAI user.
    // Should NOT see any ACME users.
    Assert.All(users, u => {
      // This is a bit indirect, but we know the emails of our seeded users
      Assert.DoesNotContain("@acme.com", u.Email);
    });
  }
}

