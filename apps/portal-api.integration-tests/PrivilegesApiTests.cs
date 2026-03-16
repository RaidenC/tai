using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Application.Models;
using Tai.Portal.Core.Application.UseCases.Privileges;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.Enums;
using Tai.Portal.Core.Domain.ValueObjects;
using Xunit;

namespace Tai.Portal.Api.IntegrationTests;

public class PrivilegesApiTests : IClassFixture<WebApplicationFactory<Program>> {
  private readonly WebApplicationFactory<Program> _factory;
  private readonly string _gatewaySecret;
  private const string AdminUserId = "00000000-0000-0000-0000-000000000010";

  public PrivilegesApiTests(WebApplicationFactory<Program> factory) {
    _factory = factory;

    // Read the secret from the same configuration the API uses
    var config = _factory.Services.GetRequiredService<IConfiguration>();
    var secret = config["GATEWAY_SECRET"];
    if (string.IsNullOrWhiteSpace(secret)) {
      secret = config["Gateway:Secret"];
    }
    _gatewaySecret = secret ?? "portal-poc-secret-2026";
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
  public async Task GetPrivileges_ReturnsPaginatedList() {
    // Arrange
    var factory = CreateFactoryWithMockAuth(AdminUserId);
    var client = factory.CreateClient();
    client.DefaultRequestHeaders.Add("X-Gateway-Secret", _gatewaySecret);

    // Act
    var response = await client.GetAsync("/api/Privileges?pageNumber=1&pageSize=10");

    // Assert
    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    var result = await response.Content.ReadFromJsonAsync<PaginatedList<PrivilegeDto>>();
    Assert.NotNull(result);
    Assert.True(result.TotalCount >= 0);
  }

  [Fact]
  public async Task CreatePrivilege_AsAdmin_Succeeds() {
    // Arrange
    var factory = CreateFactoryWithMockAuth(AdminUserId);
    var client = factory.CreateClient();
    client.DefaultRequestHeaders.Add("X-Gateway-Secret", _gatewaySecret);

    var uniqueName = $"Test.Feature.{Guid.NewGuid()}";
    var command = new CreatePrivilegeCommand(
      uniqueName,
      "Allows reading test feature",
      "TestModule",
      RiskLevel.Low,
      new JitSettings(TimeSpan.FromHours(1), false, false)
    );

    // Act
    var response = await client.PostAsJsonAsync("/api/Privileges", command);

    // Assert
    Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    var privilege = await response.Content.ReadFromJsonAsync<PrivilegeDto>();
    Assert.NotNull(privilege);
    Assert.Equal(command.Name, privilege.Name);
  }

  [Fact]
  public async Task UpdatePrivilege_WithConflict_Returns409() {
    // Arrange
    var factory = CreateFactoryWithMockAuth(AdminUserId);
    var client = factory.CreateClient();
    client.DefaultRequestHeaders.Add("X-Gateway-Secret", _gatewaySecret);

    // 1. Create a privilege
    var uniqueName = $"Conflict.Test.{Guid.NewGuid()}";
    var createCommand = new CreatePrivilegeCommand(
      uniqueName,
      "Original Description",
      "TestModule",
      RiskLevel.Low,
      new JitSettings(null, false, false)
    );
    var createResponse = await client.PostAsJsonAsync("/api/Privileges", createCommand);
    var privilege = await createResponse.Content.ReadFromJsonAsync<PrivilegeDto>();
    Assert.NotNull(privilege);

    // 2. Update it once (successful)
    var updateCommand1 = new UpdatePrivilegeCommand(
      privilege.Id,
      "Updated Description 1",
      RiskLevel.Medium,
      true,
      privilege.JitSettings,
      privilege.RowVersion
    );
    var updateResponse1 = await client.PutAsJsonAsync($"/api/Privileges/{privilege.Id}", updateCommand1);
    Assert.Equal(HttpStatusCode.OK, updateResponse1.StatusCode);

    // 3. Update it again with the OLD RowVersion (should conflict)
    var updateCommand2 = new UpdatePrivilegeCommand(
      privilege.Id,
      "Updated Description 2",
      RiskLevel.High,
      true,
      privilege.JitSettings,
      privilege.RowVersion // Using the same version as the first update
    );
    var updateResponse2 = await client.PutAsJsonAsync($"/api/Privileges/{privilege.Id}", updateCommand2);

    // Assert
    Assert.Equal(HttpStatusCode.Conflict, updateResponse2.StatusCode);
  }
}
