using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Application.UseCases.Onboarding;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.Enums;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Infrastructure.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using Xunit;

namespace Tai.Portal.Api.IntegrationTests;

public class OnboardingApiTests : IClassFixture<WebApplicationFactory<Program>> {
  private readonly WebApplicationFactory<Program> _factory;

  // Pre-seeded IDs from SeedData.cs
  private readonly Guid TaiTenantId = Guid.Parse("00000000-0000-0000-0000-000000000001");
  private readonly Guid AcmeTenantId = Guid.Parse("00000000-0000-0000-0000-000000000002");
  private const string TaiAdminId = "00000000-0000-0000-0000-000000000010";

  public OnboardingApiTests(WebApplicationFactory<Program> factory) {
    _factory = factory;
  }

  private WebApplicationFactory<Program> CreateFactoryWithMockAuthAndOtp(Mock<IOtpService> mockOtpService, string? overrideUserId = null) {
    return _factory.WithWebHostBuilder(builder => {
      builder.ConfigureTestServices(services => {
        // Replace real OTP Service with our mock
        services.AddScoped<IOtpService>(_ => mockOtpService.Object);

        var userId = overrideUserId ?? TaiAdminId;

        // Use a StartupFilter to set context.User directly, avoiding scheme conflicts
        services.AddTransient<IStartupFilter>(sp => new DynamicTestAuthStartupFilter(userId));
        services.AddSingleton<IAuthorizationHandler, AllowAnonymousAuthorizationHandler>();
        services.AddSingleton<IAuthorizationService, BypassAuthorizationService>();
      });
    });
  }

  [Fact]
  public async Task RegisterCustomer_ValidCommand_ReturnsOkAndCallsOtp() {
    // Arrange
    var mockOtpService = new Mock<IOtpService>();
    var factory = CreateFactoryWithMockAuthAndOtp(mockOtpService);
    var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
    client.DefaultRequestHeaders.Add("X-Gateway-Secret", Environment.GetEnvironmentVariable("GATEWAY_SECRET") ?? "portal-poc-secret-2026");

    var email = $"newcustomer_{Guid.NewGuid()}@example.com";
    var command = new RegisterCustomerCommand(TaiTenantId, email, "Password123!");

    // Act
    var response = await client.PostAsJsonAsync("/api/onboarding/register", command);

    // Assert
    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    var userId = await response.Content.ReadAsStringAsync();
    Assert.False(string.IsNullOrEmpty(userId));

    // Verify side-effects (OTP generated)
    mockOtpService.Verify(x => x.GenerateAndStoreOtpAsync(userId, It.IsAny<CancellationToken>()), Times.Once);
  }

  [Fact]
  public async Task RegisterCustomer_InvalidEmail_ReturnsBadRequest() {
    // Arrange
    var mockOtpService = new Mock<IOtpService>();
    var factory = CreateFactoryWithMockAuthAndOtp(mockOtpService);
    var client = factory.CreateClient();
    client.DefaultRequestHeaders.Add("X-Gateway-Secret", Environment.GetEnvironmentVariable("GATEWAY_SECRET") ?? "portal-poc-secret-2026");

    // "not-an-email" should be caught by FluentValidation
    var command = new RegisterCustomerCommand(TaiTenantId, "not-an-email", "Password123!");

    // Act
    var response = await client.PostAsJsonAsync("/api/onboarding/register", command);

    // Assert
    Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    var problemDetails = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
    Assert.NotNull(problemDetails);
    Assert.Contains(problemDetails.Errors, e => e.Key.Contains("Email"));

    // Verify side-effects (OTP NOT generated)
    mockOtpService.Verify(x => x.GenerateAndStoreOtpAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
  }

  [Fact]
  public async Task ApproveStaff_ValidApproval_ChangesStatusAndCallsOtp() {
    // Arrange
    var mockOtpService = new Mock<IOtpService>();
    // Set the approver to be the TAI Admin
    var factory = CreateFactoryWithMockAuthAndOtp(mockOtpService, TaiAdminId);
    var client = factory.CreateClient(new WebApplicationFactoryClientOptions {
      BaseAddress = new Uri("http://localhost/")
    });
    client.DefaultRequestHeaders.Add("X-Gateway-Secret", Environment.GetEnvironmentVariable("GATEWAY_SECRET") ?? "portal-poc-secret-2026");

    string targetUserId;

    // 1. Seed a user in PendingApproval state
    using (var scope = factory.Services.CreateScope()) {
      var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
      var user = new ApplicationUser($"pending_{Guid.NewGuid()}@tai.com", new TenantId(TaiTenantId)) {
        EmailConfirmed = true,
      };
      user.StartStaffOnboarding(); // Sets state to PendingApproval
      await userManager.CreateAsync(user, "Password123!");
      targetUserId = user.Id;
    }

    var request = new { TargetUserId = targetUserId };

    // Act
    var response = await client.PostAsJsonAsync("/api/onboarding/approve", request);

    // Assert
    Assert.Equal(HttpStatusCode.OK, response.StatusCode);

    // Verify state change in DB
    using (var scope = factory.Services.CreateScope()) {
      var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
      var updatedUser = await userManager.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == targetUserId);
      Assert.NotNull(updatedUser);
      Assert.Equal(UserStatus.PendingVerification, updatedUser.Status);
      Assert.Equal(TaiAdminId, updatedUser.ApprovedByUserId);
    }

    // Verify side-effects (OTP generated for target user)
    mockOtpService.Verify(x => x.GenerateAndStoreOtpAsync(targetUserId, It.IsAny<CancellationToken>()), Times.Once);
  }

  [Fact]
  public async Task GetPendingApprovals_CrossTenantIsolation_ReturnsEmptyList() {
    // Arrange
    var mockOtpService = new Mock<IOtpService>();
    var factory = CreateFactoryWithMockAuthAndOtp(mockOtpService);
    // Identify as ACME but try to fetch TAI's pending approvals
    var client = factory.CreateClient(new WebApplicationFactoryClientOptions {
      BaseAddress = new Uri("http://acme.localhost/")
    });
    client.DefaultRequestHeaders.Add("X-Gateway-Secret", Environment.GetEnvironmentVariable("GATEWAY_SECRET") ?? "portal-poc-secret-2026");

    // 1. Seed a user in PendingApproval state in TAI Tenant
    using (var scope = factory.Services.CreateScope()) {
      var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
      var tenantService = scope.ServiceProvider.GetRequiredService<ITenantService>();
      tenantService.SetTenant(new TenantId(Guid.Empty), isGlobalAccess: true); // allow saving any tenant
      var user = new ApplicationUser($"pending_{Guid.NewGuid()}@tai.com", new TenantId(TaiTenantId)) {
        EmailConfirmed = true,
      };
      user.StartStaffOnboarding();
      await userManager.CreateAsync(user, "Password123!");
    }

    // Act: Request TAI's tenant ID, but we are authenticated on Acme's host
    var response = await client.GetAsync($"/api/onboarding/pending-approvals?tenantId={TaiTenantId}");

    // Assert: Even though there is a pending user in TAI, the tenant isolation 
    // should prevent ACME from seeing it.
    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    var approvals = await response.Content.ReadFromJsonAsync<List<UserSummaryDto>>();
    Assert.NotNull(approvals);
    Assert.Empty(approvals); // Should be completely empty due to Global Query Filter on Host
  }

  [Fact]
  public async Task GetPendingApprovals_Unauthenticated_ReturnsUnauthorized() {
    // Arrange
    var factory = _factory.WithWebHostBuilder(builder => {
      builder.ConfigureTestServices(services => {
        // Do not add mock auth here
      });
    });
    var client = factory.CreateClient();
    client.DefaultRequestHeaders.Add("X-Gateway-Secret", Environment.GetEnvironmentVariable("GATEWAY_SECRET") ?? "portal-poc-secret-2026");

    // Act
    var response = await client.GetAsync($"/api/onboarding/pending-approvals?tenantId={TaiTenantId}");

    // Assert
    // Using OpenIddict default schemes might return 401
    Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
  }
}

public class DynamicTestAuthStartupFilter : IStartupFilter {
  private readonly string _userId;
  public DynamicTestAuthStartupFilter(string userId) => _userId = userId;

  public Action<Microsoft.AspNetCore.Builder.IApplicationBuilder> Configure(Action<Microsoft.AspNetCore.Builder.IApplicationBuilder> next) {
    return builder => {
      builder.Use(async (context, nextMiddleware) => {
        var claims = new[] {
            new Claim(ClaimTypes.NameIdentifier, _userId),
            new Claim(ClaimTypes.Name, "Test User"),
            new Claim("sub", _userId)
        };
        var identity = new ClaimsIdentity(claims, OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme);
        context.User = new ClaimsPrincipal(identity);
        await nextMiddleware();
      });
      next(builder);
    };
  }
}

public class AllowAnonymousAuthorizationHandler : IAuthorizationHandler {
  public Task HandleAsync(AuthorizationHandlerContext context) {
    foreach (var requirement in context.PendingRequirements.ToList()) {
      context.Succeed(requirement);
    }
    return Task.CompletedTask;
  }
}
