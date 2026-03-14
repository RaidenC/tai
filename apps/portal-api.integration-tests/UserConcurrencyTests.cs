using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Identity;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Application.UseCases.Users;
using Xunit;

namespace Tai.Portal.Api.IntegrationTests;

public class UserConcurrencyTests : IClassFixture<WebApplicationFactory<Program>> {
  private readonly WebApplicationFactory<Program> _factory;
  private readonly Guid TaiTenantId = Guid.Parse("00000000-0000-0000-0000-000000000001");
  private const string TaiAdminId = "00000000-0000-0000-0000-000000000010";

  public UserConcurrencyTests(WebApplicationFactory<Program> factory) {
    _factory = factory;
  }

  private WebApplicationFactory<Program> CreateFactoryWithMockAuth(string userId) {
    return _factory.WithWebHostBuilder(builder => {
      builder.ConfigureTestServices(services => {
        services.AddAuthentication(options => {
          options.DefaultAuthenticateScheme = "IntegrationTestAuth";
          options.DefaultChallengeScheme = "IntegrationTestAuth";
        })
        .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>("IntegrationTestAuth", options => { });

        services.AddAuthorization(options => {
          options.DefaultPolicy = new AuthorizationPolicyBuilder()
              .AddAuthenticationSchemes("IntegrationTestAuth")
              .RequireAuthenticatedUser()
              .Build();
        });

        services.AddSingleton(new TestUserContext { UserId = userId });
        services.AddSingleton<IAuthorizationHandler, AllowAnonymousAuthorizationHandler>();
        services.AddSingleton<IAuthorizationService, BypassAuthorizationService>();
      });
    });
  }

  [Fact]
  public async Task GetUserById_ReturnsETagHeader() {
    // Arrange
    var factory = CreateFactoryWithMockAuth(TaiAdminId);
    var client = factory.CreateClient(new WebApplicationFactoryClientOptions {
      BaseAddress = new Uri("http://localhost/")
    });
    client.DefaultRequestHeaders.Add("X-Gateway-Secret", Environment.GetEnvironmentVariable("GATEWAY_SECRET") ?? "portal-poc-secret-2026");

    string testUserId;
    using (var scope = factory.Services.CreateScope()) {
      var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
      var tenantService = scope.ServiceProvider.GetRequiredService<ITenantService>();

      tenantService.SetTenant(new TenantId(Guid.Empty), isGlobalAccess: true);

      var user = new ApplicationUser($"concurrency_test_{Guid.NewGuid()}@tai.com", new TenantId(TaiTenantId)) { EmailConfirmed = true };
      await userManager.CreateAsync(user, "Password123!");
      testUserId = user.Id;
    }

    // Act
    var response = await client.GetAsync($"/api/Users/{testUserId}");

    // Assert
    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    Assert.True(response.Headers.Contains("ETag"), "Response should contain ETag header");
    var etag = response.Headers.ETag?.Tag;
    Assert.False(string.IsNullOrEmpty(etag), "ETag header value should not be empty");
  }

  [Fact]
  public async Task ApproveUser_ReturnsConflict_WhenETagMismatch() {
    // Arrange
    var factory = CreateFactoryWithMockAuth(TaiAdminId);
    var client = factory.CreateClient(new WebApplicationFactoryClientOptions {
      BaseAddress = new Uri("http://localhost/")
    });
    client.DefaultRequestHeaders.Add("X-Gateway-Secret", Environment.GetEnvironmentVariable("GATEWAY_SECRET") ?? "portal-poc-secret-2026");

    string testUserId;
    using (var scope = factory.Services.CreateScope()) {
      var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
      var tenantService = scope.ServiceProvider.GetRequiredService<ITenantService>();
      tenantService.SetTenant(new TenantId(Guid.Empty), isGlobalAccess: true);

      var user = new ApplicationUser($"concurrency_conflict_{Guid.NewGuid()}@tai.com", new TenantId(TaiTenantId)) { EmailConfirmed = true };
      user.StartStaffOnboarding(); // PendingApproval
      await userManager.CreateAsync(user, "Password123!");
      testUserId = user.Id;
    }

    // Act: Send wrong ETag
    client.DefaultRequestHeaders.Add("If-Match", "\"99999\"");
    var response = await client.PostAsync($"/api/Users/{testUserId}/approve", null);

    // Assert
    Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
  }

  [Fact]
  public async Task ApproveUser_Succeeds_WhenETagMatches() {
    // Arrange
    var factory = CreateFactoryWithMockAuth(TaiAdminId);
    var client = factory.CreateClient(new WebApplicationFactoryClientOptions {
      BaseAddress = new Uri("http://localhost/")
    });
    client.DefaultRequestHeaders.Add("X-Gateway-Secret", Environment.GetEnvironmentVariable("GATEWAY_SECRET") ?? "portal-poc-secret-2026");

    string testUserId;
    using (var scope = factory.Services.CreateScope()) {
      var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
      var tenantService = scope.ServiceProvider.GetRequiredService<ITenantService>();
      tenantService.SetTenant(new TenantId(Guid.Empty), isGlobalAccess: true);

      var user = new ApplicationUser($"concurrency_success_{Guid.NewGuid()}@tai.com", new TenantId(TaiTenantId)) { EmailConfirmed = true };
      user.StartStaffOnboarding(); // PendingApproval
      await userManager.CreateAsync(user, "Password123!");
      testUserId = user.Id;
    }

    // 1. Get current ETag
    var getResponse = await client.GetAsync($"/api/Users/{testUserId}");
    var etag = getResponse.Headers.ETag?.Tag;

    // 2. Approve with correct ETag
    client.DefaultRequestHeaders.Add("If-Match", etag);
    var response = await client.PostAsync($"/api/Users/{testUserId}/approve", null);

    // Assert
    Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
  }
}
