using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Tai.Portal.Core.Application.Models;
using Tai.Portal.Core.Domain.Enums;
using Tai.Portal.Core.Domain.ValueObjects;
using Xunit;

namespace Tai.Portal.Api.IntegrationTests;

public class SecurityAndTdmTests : IClassFixture<WebApplicationFactory<Program>> {
  private readonly WebApplicationFactory<Program> _factory;
  private readonly string _gatewaySecret;
  private const string AdminUserId = "00000000-0000-0000-0000-000000000010";

  public SecurityAndTdmTests(WebApplicationFactory<Program> factory) {
    _factory = factory;
    var config = _factory.Services.GetRequiredService<IConfiguration>();
    var secret = config["GATEWAY_SECRET"];
    if (string.IsNullOrWhiteSpace(secret)) {
      secret = config["Gateway:Secret"];
    }
    _gatewaySecret = secret ?? "portal-poc-secret-2026";

    // Trigger initialization on startup
    _ = _factory.Server;
  }

  private async Task ResetDatabase() {
    var client = CreateClient();
    client.DefaultRequestHeaders.Add("X-Gateway-Secret", _gatewaySecret);

    // Retry logic for Reset because EnsureDeleted/Initialize is heavy
    for (int i = 0; i < 3; i++) {
      try {
        var response = await client.PostAsync("/api/tdm/reset", null);
        if (response.IsSuccessStatusCode) return;
      } catch {
        if (i == 2) throw;
      }
      await Task.Delay(1000);
    }
  }

  private HttpClient CreateClient(WebApplicationFactory<Program>? factory = null) {
    var client = (factory ?? _factory).CreateClient();
    client.DefaultRequestHeaders.Add("Host", "localhost");
    return client;
  }

  private WebApplicationFactory<Program> CreateFactoryWithMockAuth(string userId) {
    return _factory.WithWebHostBuilder(builder => {
      builder.ConfigureTestServices(services => {
        services.AddSingleton(new TestUserContext { UserId = userId });
        services.AddAuthentication("IntegrationTestAuth")
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>("IntegrationTestAuth", null);

        services.AddAuthorization(options => {
          options.DefaultPolicy = new AuthorizationPolicyBuilder("IntegrationTestAuth")
              .RequireAuthenticatedUser()
              .Build();
        });
      });
    });
  }

  [Fact]
  public async Task Request_WithoutGatewaySecret_Returns403() {
    // Arrange
    var client = CreateClient();

    // Act
    var response = await client.GetAsync("/api/privileges");

    // Assert
    Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    var content = await response.Content.ReadAsStringAsync();
    Assert.Contains("Access must be via the Gateway", content);
  }

  [Fact]
  public async Task TdmReset_WipesAndReseedsDatabase() {
    // Arrange
    var client = CreateClient();
    client.DefaultRequestHeaders.Add("X-Gateway-Secret", _gatewaySecret);

    // Act
    var response = await client.PostAsync("/api/tdm/reset", null);

    // Assert
    response.EnsureSuccessStatusCode();
    var result = await response.Content.ReadFromJsonAsync<dynamic>();
    Assert.NotNull(result);
  }

  [Fact]
  public async Task UpdateHighRiskPrivilege_WithoutStepUpHeader_Returns403WithStepUpRequired() {
    // Arrange
    var factory = CreateFactoryWithMockAuth(AdminUserId);
    var client = CreateClient(factory);
    client.DefaultRequestHeaders.Add("X-Gateway-Secret", _gatewaySecret);

    // Get a high-risk privilege (e.g., System.Settings.Modify from SeedData)
    var privileges = await client.GetFromJsonAsync<PaginatedList<PrivilegeDto>>("/api/privileges?search=System.Settings.Modify");
    var privilege = privileges!.Items.First();

    var updateCommand = new {
      Id = privilege.Id,
      Description = "Updated high-risk description",
      RiskLevel = RiskLevel.Critical, // Keep it high
      IsActive = true,
      JitSettings = privilege.JitSettings,
      RowVersion = privilege.RowVersion
    };

    // Act
    var response = await client.PutAsJsonAsync($"/api/privileges/{privilege.Id}", updateCommand);

    // Assert
    Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    Assert.True(response.Headers.Contains("X-Step-Up-Required"));
    Assert.Equal("true", response.Headers.GetValues("X-Step-Up-Required").First());
  }

  [Fact]
  public async Task UpdateHighRiskPrivilege_WithStepUpHeader_Succeeds() {
    // Arrange
    var factory = CreateFactoryWithMockAuth(AdminUserId);
    var client = CreateClient(factory);
    client.DefaultRequestHeaders.Add("X-Gateway-Secret", _gatewaySecret);
    client.DefaultRequestHeaders.Add("X-Step-Up-Verified", "true");

    var privileges = await client.GetFromJsonAsync<PaginatedList<PrivilegeDto>>("/api/privileges?search=System.Settings.Modify");
    var privilege = privileges!.Items.First();

    var updateCommand = new {
      Id = privilege.Id,
      Description = "Updated high-risk description with step-up",
      RiskLevel = RiskLevel.Critical,
      IsActive = true,
      JitSettings = privilege.JitSettings,
      RowVersion = privilege.RowVersion
    };

    // Act
    var response = await client.PutAsJsonAsync($"/api/privileges/{privilege.Id}", updateCommand);

    // Assert
    response.EnsureSuccessStatusCode();
  }
}
