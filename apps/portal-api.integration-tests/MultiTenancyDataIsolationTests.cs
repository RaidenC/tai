using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Tai.Portal.Core.Domain.ValueObjects;
using Xunit;

namespace Tai.Portal.Api.IntegrationTests;

/**
 * Multi-Tenancy Data Isolation Integration Tests
 * 
 * JUNIOR RATIONALE: This suite ensures that our "Tenancy Walls" are solid. 
 * Even if an attacker knows the exact database ID of a different bank's 
 * user or tenant record, they should NEVER be able to see that data. 
 * The system must return a 404 (Not Found) as if the data doesn't even exist.
 */
public class MultiTenancyDataIsolationTests : IClassFixture<WebApplicationFactory<Program>> {
  private readonly WebApplicationFactory<Program> _factory;
  private string GatewaySecret => Environment.GetEnvironmentVariable("GATEWAY_SECRET") ??
                                  "portal-poc-secret-2026";

  // Pre-seeded IDs from SeedData.cs
  private readonly Guid TaiTenantId = Guid.Parse("00000000-0000-0000-0000-000000000001");
  private readonly Guid AcmeTenantId = Guid.Parse("00000000-0000-0000-0000-000000000002");
  private const string TaiUserId = "00000000-0000-0000-0000-000000000010";
  private const string AcmeUserId = "00000000-0000-0000-0000-000000000020";

  public MultiTenancyDataIsolationTests(WebApplicationFactory<Program> factory) {
    _factory = factory.WithWebHostBuilder(builder => {
      builder.ConfigureTestServices(services => {
        // JUNIOR RATIONALE: We bypass the entire OIDC security handshake 
        // to focus exclusively on the Multi-Tenant Data Isolation logic. 
        // We set context.User in a middleware and then tell the Authorization 
        // engine to always say 'Yes'.
        services.AddTransient<IStartupFilter, TestAuthStartupFilter>();
        services.AddSingleton<IAuthorizationService, BypassAuthorizationService>();
      });
    });
  }

  [Fact]
  public async Task TaiUser_CannotAccess_AcmeTenantRecord() {
    // 1. Arrange: Identify as TAI (localhost)
    var client = _factory.CreateClient(new WebApplicationFactoryClientOptions {
      BaseAddress = new Uri("http://localhost/")
    });
    client.DefaultRequestHeaders.Add("X-Gateway-Secret", GatewaySecret);

    // 2. Act: Try to fetch ACME's tenant ID directly.
    var response = await client.GetAsync($"/api/TenantData/tenants/{AcmeTenantId}");

    // 3. Assert: Verify we get 404 Not Found.
    Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
  }

  [Fact]
  public async Task AcmeUser_CannotAccess_TaiUserRecord() {
    // 1. Arrange: Identify as ACME (acme.localhost)
    var client = _factory.CreateClient(new WebApplicationFactoryClientOptions {
      BaseAddress = new Uri("http://acme.localhost/")
    });
    client.DefaultRequestHeaders.Add("X-Gateway-Secret", GatewaySecret);

    // 2. Act: Try to fetch TAI's admin user ID directly.
    var response = await client.GetAsync($"/api/TenantData/users/{TaiUserId}");

    // 3. Assert: Verify we get 404 Not Found.
    Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
  }

  [Fact]
  public async Task TaiUser_CAN_Access_TaiTenantRecord() {
    // 1. Arrange: Identify as TAI (localhost)
    var client = _factory.CreateClient(new WebApplicationFactoryClientOptions {
      BaseAddress = new Uri("http://localhost/")
    });
    client.DefaultRequestHeaders.Add("X-Gateway-Secret", GatewaySecret);

    // 2. Act: Fetch our OWN tenant ID.
    var response = await client.GetAsync($"/api/TenantData/tenants/{TaiTenantId}");

    // 3. Assert: Success!
    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    var data = await response.Content.ReadFromJsonAsync<TenantResponse>();
    Assert.NotNull(data);
    Assert.Equal(TaiTenantId, data.Id.Value);
  }
}

public class TenantResponse {
  public TenantIdWrapper Id { get; set; } = new();
  public string Name { get; set; } = string.Empty;
  public string TenantHostname { get; set; } = string.Empty;
}

public class TenantIdWrapper {
  public Guid Value { get; set; }
}

/**
 * TestAuthStartupFilter: Injects the TestAuthMiddleware into the pipeline.
 */
public class TestAuthStartupFilter : IStartupFilter {
  public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) {
    return builder => {
      builder.Use(async (context, nextMiddleware) => {
        var claims = new[] {
            new Claim(ClaimTypes.Name, "Test User"),
            new Claim("sub", "test-sub")
        };
        var identity = new ClaimsIdentity(claims, IdentityConstants.ApplicationScheme);
        context.User = new ClaimsPrincipal(identity);
        await nextMiddleware();
      });
      next(builder);
    };
  }
}

/**
 * BypassAuthorizationService: Always grants access regardless of tokens.
 */
public class BypassAuthorizationService : IAuthorizationService {
  public Task<AuthorizationResult> AuthorizeAsync(ClaimsPrincipal user, object? resource, IEnumerable<IAuthorizationRequirement> requirements)
      => Task.FromResult(AuthorizationResult.Success());

  public Task<AuthorizationResult> AuthorizeAsync(ClaimsPrincipal user, object? resource, string policyName)
      => Task.FromResult(AuthorizationResult.Success());
}
