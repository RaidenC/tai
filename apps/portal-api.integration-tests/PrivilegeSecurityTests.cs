using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Application.Models;
using Tai.Portal.Core.Application.UseCases.Privileges;
using Tai.Portal.Core.Domain.Enums;
using Tai.Portal.Core.Domain.ValueObjects;
using Xunit;

namespace Tai.Portal.Api.IntegrationTests;

public class PrivilegeSecurityTests : IClassFixture<WebApplicationFactory<Program>> {
  private readonly WebApplicationFactory<Program> _factory;
  private readonly string _gatewaySecret;
  private const string AdminUserId = "00000000-0000-0000-0000-000000000010";
  private const string NormalUserId = "00000000-0000-0000-0000-000000000021"; // user1@tai.com

  public PrivilegeSecurityTests(WebApplicationFactory<Program> factory) {
    _factory = factory;
    var config = _factory.Services.GetRequiredService<IConfiguration>();
    _gatewaySecret = config["GATEWAY_SECRET"] ?? config["Gateway:Secret"] ?? "portal-poc-secret-2026";
    _ = _factory.Server;
  }

  private WebApplicationFactory<Program> CreateFactoryWithMockAuth(string userId, string[] roles) {
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

          // DO NOT add bypass handlers here, we want to test the real [Authorize] logic
        });

        services.AddSingleton(new TestUserContext { UserId = userId, Roles = roles });
      });
    });
  }

  private HttpClient CreateClient(WebApplicationFactory<Program>? factory = null, string? customSecret = null) {
    var client = (factory ?? _factory).CreateClient();
    client.DefaultRequestHeaders.Add("X-Gateway-Secret", customSecret ?? _gatewaySecret);
    client.DefaultRequestHeaders.Add("X-Step-Up-Verified", "true");
    client.DefaultRequestHeaders.Add("Host", "localhost");
    return client;
  }

  [Fact]
  public async Task CreatePrivilege_AsNormalUser_Returns403Forbidden() {
    // Arrange
    var factory = CreateFactoryWithMockAuth(NormalUserId, Array.Empty<string>());
    var client = CreateClient(factory);

    var command = new CreatePrivilegeCommand(
      "Unauthorized.Privilege",
      "Should fail",
      "Test",
      RiskLevel.Low,
      new JitSettings()
    );

    // Act
    var response = await client.PostAsJsonAsync("/api/Privileges", command);

    // Assert
    Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
  }

  [Fact]
  public async Task CreatePrivilege_AsAdmin_Succeeds() {
    // Arrange
    var factory = CreateFactoryWithMockAuth(AdminUserId, new[] { "Admin" });
    var client = CreateClient(factory);

    var uniqueName = $"Security.Test.{Guid.NewGuid()}";
    var command = new CreatePrivilegeCommand(
      uniqueName,
      "Allows testing security",
      "Test",
      RiskLevel.Low,
      new JitSettings()
    );

    // Act
    var response = await client.PostAsJsonAsync("/api/Privileges", command);

    // Assert
    Assert.Equal(HttpStatusCode.Created, response.StatusCode);
  }

  [Fact]
  public async Task UpdatePrivilege_AsNormalUser_Returns403Forbidden() {
    // Arrange
    var factory = CreateFactoryWithMockAuth(NormalUserId, Array.Empty<string>());
    var client = CreateClient(factory);

    // Use a known existing privilege ID from SeedData or previous tests
    // In these tests, we usually have some seeded data or can create one as admin first
    var adminFactory = CreateFactoryWithMockAuth(AdminUserId, new[] { "Admin" });
    var adminClient = CreateClient(adminFactory);
    var createResponse = await adminClient.PostAsJsonAsync("/api/Privileges", new CreatePrivilegeCommand(
        $"Security.Update.{Guid.NewGuid()}", "Test", "Test", RiskLevel.Low, new JitSettings()));
    var privilege = await createResponse.Content.ReadFromJsonAsync<PrivilegeDto>();

    var command = new UpdatePrivilegeCommand(
      privilege!.Id,
      "Should fail",
      RiskLevel.Low,
      true,
      new JitSettings(),
      privilege.RowVersion
    );

    // Act
    var response = await client.PutAsJsonAsync($"/api/Privileges/{command.Id}", command);

    // Assert
    Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
  }

  [Fact]
  public async Task UpdatePrivilege_HighRisk_WithoutStepUp_Returns403ForbiddenWithHeader() {
    // Arrange
    var factory = CreateFactoryWithMockAuth(AdminUserId, new[] { "Admin" });
    var client = CreateClient(factory);
    client.DefaultRequestHeaders.Remove("X-Step-Up-Verified");
    client.DefaultRequestHeaders.Add("X-Step-Up-Verified", "false");

    var command = new UpdatePrivilegeCommand(
      Guid.NewGuid(),
      "Should fail due to risk",
      RiskLevel.High,
      true,
      new JitSettings(),
      0
    );

    // Act
    var response = await client.PutAsJsonAsync($"/api/Privileges/{command.Id}", command);

    // Assert
    Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    Assert.True(response.Headers.Contains("X-Step-Up-Required"));
  }

  [Fact]
  public async Task AnyEndpoint_WithoutGatewaySecret_Returns403Forbidden() {
    // Arrange
    var client = _factory.CreateClient();
    // No X-Gateway-Secret added

    // Act
    var response = await client.GetAsync("/api/Privileges");

    // Assert
    Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    var body = await response.Content.ReadAsStringAsync();
    Assert.Contains("Access must be via the Gateway", body);
  }

  [Fact]
  public async Task AnyEndpoint_WithWrongGatewaySecret_Returns403Forbidden() {
    // Arrange
    var client = CreateClient(customSecret: "wrong-secret");

    // Act
    var response = await client.GetAsync("/api/Privileges");

    // Assert
    Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
  }
}
