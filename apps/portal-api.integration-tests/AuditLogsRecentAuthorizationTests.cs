/**
 * Audit Logs Recent Authorization Integration Tests
 *
 * JUNIOR RATIONALE: This suite verifies the "Tenancy Walls" and gateway security
 * for the notification center's /api/AuditLogs/recent endpoint. The tests ensure:
 *
 * 1. Host-based tenant isolation: Each tenant's audit logs are completely isolated
 *    by the host header. A request to acme.localhost cannot see tai.localhost's data.
 *
 * 2. Browser header security: Tenant IDs and bypass flags from the browser are
 *    explicitly ignored. The TenantResolutionMiddleware extracts tenant from HOST,
 *    not from headers that a malicious client could forge.
 *
 * 3. Gateway trust: The X-Gateway-Secret header validates that requests come from
 *    our trusted reverse proxy, not directly from browsers. A wrong secret yields 403.
 *
 * 4. Role-based access: Only Admin users can view audit logs. Non-admins get 403.
 *
 * 5. Authentication required: Unauthenticated requests get 401, not data leakage.
 */
using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Infrastructure.Persistence;
using Xunit;

namespace Tai.Portal.Api.IntegrationTests;

public class AuditLogsRecentAuthorizationTests : IClassFixture<WebApplicationFactory<Program>>, IAsyncLifetime {
  private static readonly TenantId TaiTenantId = new(Guid.Parse("00000000-0000-0000-0000-000000000001"));
  private static readonly TenantId AcmeTenantId = new(Guid.Parse("00000000-0000-0000-0000-000000000002"));
  private const string AdminUserId = "00000000-0000-0000-0000-000000000010";
  private readonly WebApplicationFactory<Program> _factory;
  private readonly string _gatewaySecret;

  // Track the current test's factory for cleanup
  private WebApplicationFactory<Program>? _currentTestFactory;

  public AuditLogsRecentAuthorizationTests(WebApplicationFactory<Program> factory) {
    _factory = factory;
    var config = _factory.Services.GetRequiredService<IConfiguration>();
    _gatewaySecret = config["GATEWAY_SECRET"] ?? config["Gateway:Secret"] ?? "portal-poc-secret-2026";
    _ = _factory.Server;
  }

  public Task InitializeAsync() => Task.CompletedTask;

  public async Task DisposeAsync() {
    // Clean up any audit logs created during the test
    // JUNIOR RATIONALE: We use IgnoreQueryFilters to bypass tenant isolation and delete
    // test data across all tenants. The correlation ID prefixes "tai-" and "acme-" are
    // used exclusively by these tests, making cleanup safe and deterministic.
    if (_currentTestFactory != null) {
      using var scope = _currentTestFactory.Services.CreateScope();
      var dbContext = scope.ServiceProvider.GetRequiredService<PortalDbContext>();
      await dbContext.AuditLogs.IgnoreQueryFilters()
          .Where(a => a.CorrelationId != null && (a.CorrelationId.StartsWith("tai-") || a.CorrelationId.StartsWith("acme-")))
          .ExecuteDeleteAsync();
    }
  }

  [Fact]
  public async Task Recent_ReturnsOnlyCurrentHostTenantAuditLogs() {
    var taiCorrelationId = $"tai-{Guid.NewGuid()}";
    var acmeCorrelationId = $"acme-{Guid.NewGuid()}";
    _currentTestFactory = CreateFactoryWithMockAuth(AdminUserId, new[] { "Admin" });
    await SeedAuditLogs(_currentTestFactory, taiCorrelationId, acmeCorrelationId);

    var client = CreateAdminClient(_currentTestFactory, "http://localhost/");
    var response = await client.GetAsync("/api/AuditLogs/recent?limit=50");

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    var rows = await response.Content.ReadFromJsonAsync<List<RecentAuditLogResponse>>();
    Assert.NotNull(rows);
    Assert.Contains(rows, row => row.CorrelationId == taiCorrelationId);
    Assert.DoesNotContain(rows, row => row.CorrelationId == acmeCorrelationId);
    Assert.All(rows, row => Assert.Equal(TaiTenantId.Value, row.GetTenantIdValue()));
  }

  [Fact]
  public async Task Recent_ReturnsOnlyAcmeHostTenantAuditLogs() {
    var taiCorrelationId = $"tai-{Guid.NewGuid()}";
    var acmeCorrelationId = $"acme-{Guid.NewGuid()}";
    _currentTestFactory = CreateFactoryWithMockAuth(AdminUserId, new[] { "Admin" });
    await SeedAuditLogs(_currentTestFactory, taiCorrelationId, acmeCorrelationId);

    var client = CreateAdminClient(_currentTestFactory, "http://acme.localhost/");
    var response = await client.GetAsync("/api/AuditLogs/recent?limit=50");

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    var rows = await response.Content.ReadFromJsonAsync<List<RecentAuditLogResponse>>();
    Assert.NotNull(rows);
    Assert.Contains(rows, row => row.CorrelationId == acmeCorrelationId);
    Assert.DoesNotContain(rows, row => row.CorrelationId == taiCorrelationId);
    Assert.All(rows, row => Assert.Equal(AcmeTenantId.Value, row.GetTenantIdValue()));
  }

  [Fact]
  public async Task Recent_IgnoresBrowserSuppliedTenantBypassHeaders() {
    var taiCorrelationId = $"tai-{Guid.NewGuid()}";
    var acmeCorrelationId = $"acme-{Guid.NewGuid()}";
    _currentTestFactory = CreateFactoryWithMockAuth(AdminUserId, new[] { "Admin" });
    await SeedAuditLogs(_currentTestFactory, taiCorrelationId, acmeCorrelationId);

    var client = CreateAdminClient(_currentTestFactory, "http://localhost/");
    client.DefaultRequestHeaders.Add("X-Bypass-Tenant", "true");
    client.DefaultRequestHeaders.Add("X-Tenant-Id", AcmeTenantId.Value.ToString());

    var response = await client.GetAsync("/api/AuditLogs/recent?limit=50");

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    var rows = await response.Content.ReadFromJsonAsync<List<RecentAuditLogResponse>>();
    Assert.NotNull(rows);
    Assert.Contains(rows, row => row.CorrelationId == taiCorrelationId);
    Assert.DoesNotContain(rows, row => row.CorrelationId == acmeCorrelationId);
    Assert.All(rows, row => Assert.Equal(TaiTenantId.Value, row.GetTenantIdValue()));
  }

  [Fact]
  public async Task Recent_Returns401WhenUnauthenticated() {
    _currentTestFactory = CreateFactoryWithMockAuth("", Array.Empty<string>());
    var client = CreateAdminClient(_currentTestFactory, "http://localhost/");

    var response = await client.GetAsync("/api/AuditLogs/recent?limit=50");

    Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
  }

  [Fact]
  public async Task Recent_Returns403ForNonAdminRole() {
    _currentTestFactory = CreateFactoryWithMockAuth("00000000-0000-0000-0000-000000000021", Array.Empty<string>());
    var client = CreateAdminClient(_currentTestFactory, "http://localhost/");

    var response = await client.GetAsync("/api/AuditLogs/recent?limit=50");

    Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
  }

  [Fact]
  public async Task Recent_Returns403WithWrongGatewaySecret() {
    _currentTestFactory = CreateFactoryWithMockAuth(AdminUserId, new[] { "Admin" });
    var client = _currentTestFactory.CreateClient(new WebApplicationFactoryClientOptions {
      BaseAddress = new Uri("http://localhost/")
    });
    client.DefaultRequestHeaders.Add("X-Gateway-Secret", "wrong-secret");

    var response = await client.GetAsync("/api/AuditLogs/recent?limit=50");

    Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
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
        });

        services.AddSingleton(new TestUserContext { UserId = userId, Roles = roles });
      });
    });
  }

  private HttpClient CreateAdminClient(WebApplicationFactory<Program> factory, string baseAddress) {
    var client = factory.CreateClient(new WebApplicationFactoryClientOptions {
      BaseAddress = new Uri(baseAddress)
    });
    client.DefaultRequestHeaders.Add("X-Gateway-Secret", _gatewaySecret);
    return client;
  }

  private async Task SeedAuditLogs(WebApplicationFactory<Program> factory, string taiCorrelationId, string acmeCorrelationId) {
    using var scope = factory.Services.CreateScope();
    var tenantService = scope.ServiceProvider.GetRequiredService<ITenantService>();
    var db = scope.ServiceProvider.GetRequiredService<PortalDbContext>();
    tenantService.SetTenant(new TenantId(Guid.Empty), isGlobalAccess: true);
    db.AuditLogs.Add(new AuditEntry(TaiTenantId, "tai-user", "PrivilegeModified", "tai-resource", taiCorrelationId, "127.0.0.1", "tai row"));
    db.AuditLogs.Add(new AuditEntry(AcmeTenantId, "acme-user", "PrivilegeModified", "acme-resource", acmeCorrelationId, "127.0.0.1", "acme row"));
    await db.SaveChangesAsync();
  }

  private sealed class RecentAuditLogResponse {
    public Guid Id { get; set; }
    public required TenantIdResponse TenantId { get; set; }
    public string? CorrelationId { get; set; }

    public Guid GetTenantIdValue() => TenantId.Value;
  }

  private sealed class TenantIdResponse {
    public Guid Value { get; set; }
  }
}