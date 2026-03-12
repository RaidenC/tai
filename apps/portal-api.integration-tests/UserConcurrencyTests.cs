using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Identity;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Application.UseCases.Users;
using Tai.Portal.Core.Application.Constants;
using Xunit;
using Tai.Portal.Core.Application.Interfaces;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Configuration;

namespace Tai.Portal.Api.IntegrationTests;

/// <summary>
/// User Concurrency Integration Tests
///
/// These tests verify the "Steel Thread" of our optimistic
/// concurrency implementation. We ensure that the ETag is correctly issued
/// and that any attempt to update stale data using 'If-Match' is rejected.
/// </summary>
public class UserConcurrencyTests : IClassFixture<WebApplicationFactory<Program>> {
  private readonly WebApplicationFactory<Program> _factory;
  private readonly Guid TaiTenantId = Guid.Parse("00000000-0000-0000-0000-000000000001");
  private const string TaiAdminId = "00000000-0000-0000-0000-000000000010";

  public UserConcurrencyTests(WebApplicationFactory<Program> factory) {
    _factory = factory;
  }

  private HttpClient CreateClientWithHost(WebApplicationFactory<Program> factory) {
    var client = factory.CreateClient(new WebApplicationFactoryClientOptions {
      BaseAddress = new Uri("http://localhost/")
    });
    client.DefaultRequestHeaders.Add("X-Gateway-Secret", "portal-poc-secret-2026");
    return client;
  }

  private WebApplicationFactory<Program> CreateFactoryWithMockAuth(string userId) {
    return _factory.WithWebHostBuilder(builder => {
      builder.ConfigureTestServices(services => {
        // Register a mock authentication handler
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
  public async Task GetUserById_ReturnsETagHeader() {
    // Arrange
    var factory = CreateFactoryWithMockAuth(TaiAdminId);
    var client = CreateClientWithHost(factory);

    string userId;
    using (var scope = factory.Services.CreateScope()) {
      var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
      var tenantService = scope.ServiceProvider.GetRequiredService<ITenantService>();

      // Crucial: Set tenant context for the manager during setup
      tenantService.SetTenant(new TenantId(TaiTenantId));

      var user = new ApplicationUser($"test_{Guid.NewGuid()}@tai.com", new TenantId(TaiTenantId));
      var result = await userManager.CreateAsync(user, "Password123!");
      Assert.True(result.Succeeded, $"User creation failed: {string.Join(", ", result.Errors.Select(e => e.Description))}");
      userId = user.Id;
    }

    // Act
    var response = await client.GetAsync($"/api/Users/{userId}");

    // Assert
    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    Assert.True(response.Headers.Contains("ETag"), "Response should contain ETag header");
    var etag = response.Headers.ETag?.Tag;
    Assert.False(string.IsNullOrEmpty(etag), "ETag should not be empty");
  }

  [Fact]
  public async Task ApproveUser_WithMismatchingETag_ReturnsConflict() {
    // Arrange
    var factory = CreateFactoryWithMockAuth(TaiAdminId);
    var client = CreateClientWithHost(factory);

    string userId;
    using (var scope = factory.Services.CreateScope()) {
      var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
      var tenantService = scope.ServiceProvider.GetRequiredService<ITenantService>();

      tenantService.SetTenant(new TenantId(TaiTenantId));

      var user = new ApplicationUser($"test_{Guid.NewGuid()}@tai.com", new TenantId(TaiTenantId));
      user.StartStaffOnboarding();
      var result = await userManager.CreateAsync(user, "Password123!");
      Assert.True(result.Succeeded, $"User creation failed: {string.Join(", ", result.Errors.Select(e => e.Description))}");
      userId = user.Id;
    }

    // Act: Attempt approval with a fake/wrong ETag (numeric string in quotes)
    var request = new { TargetUserId = userId };
    var httpRequest = new HttpRequestMessage(HttpMethod.Post, "/api/Onboarding/approve") {
      Content = JsonContent.Create(request)
    };
    httpRequest.Headers.Add("If-Match", "\"999999\"");

    var response = await client.SendAsync(httpRequest);

    // Assert
    Assert.Equal(HttpStatusCode.PreconditionFailed, response.StatusCode); // Or 409 Conflict
  }

  [Fact]
  public async Task ApproveUser_WithMalformedETag_ReturnsBadRequest() {
    // Arrange
    var factory = CreateFactoryWithMockAuth(TaiAdminId);
    var client = CreateClientWithHost(factory);

    // Act
    var request = new { TargetUserId = Guid.NewGuid().ToString() };
    var httpRequest = new HttpRequestMessage(HttpMethod.Post, "/api/Onboarding/approve") {
      Content = JsonContent.Create(request)
    };
    httpRequest.Headers.Add("If-Match", "\"not-a-number\"");

    var response = await client.SendAsync(httpRequest);

    // Assert
    Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
  }
}
