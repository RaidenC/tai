using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
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

  private record RegisterResponse(string UserId);

  private WebApplicationFactory<Program> CreateFactoryWithMockAuthAndOtp(Mock<IOtpService> mockOtpService, string? overrideUserId = null) {
    return _factory.WithWebHostBuilder(builder => {
      builder.ConfigureTestServices(services => {
        // Replace real OTP Service with our mock
        services.AddScoped<IOtpService>(_ => mockOtpService.Object);

        var userId = overrideUserId ?? TaiAdminId;

        // Add a mock authentication handler with a UNIQUE name for tests
        services.AddAuthentication(options => {
          options.DefaultAuthenticateScheme = "IntegrationTestAuth";
          options.DefaultChallengeScheme = "IntegrationTestAuth";
        })
        .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>("IntegrationTestAuth", options => { });

        // Override the DefaultPolicy to use our test scheme
        services.AddAuthorization(options => {
          options.DefaultPolicy = new AuthorizationPolicyBuilder()
              .AddAuthenticationSchemes("IntegrationTestAuth")
              .RequireAuthenticatedUser()
              .Build();
        });

        // We also need to provide the UserId to the handler
        services.AddSingleton(new TestUserContext { UserId = userId });

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
    var request = new { Email = email, Password = "Password123!", FirstName = "Test", LastName = "Customer" };

    // Act
    var response = await client.PostAsJsonAsync("/api/onboarding/register", request);

    // Assert
    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    var result = await response.Content.ReadFromJsonAsync<RegisterResponse>();
    Assert.NotNull(result);
    var userId = result.UserId;
    Assert.False(string.IsNullOrEmpty(userId));

    // Verify User is in PendingVerification status (Customer)
    using (var scope = factory.Services.CreateScope()) {
      var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
      var user = await userManager.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == userId);
      Assert.NotNull(user);
      Assert.Equal(UserStatus.PendingVerification, user.Status);
    }

    // Verify side-effects (OTP generated)
    mockOtpService.Verify(x => x.GenerateAndStoreOtpAsync(userId, It.IsAny<CancellationToken>()), Times.Once);
  }

  [Fact]
  public async Task RegisterStaff_ValidCommand_ReturnsOkAndRequiresApproval() {
    // Arrange
    var mockOtpService = new Mock<IOtpService>();
    var factory = CreateFactoryWithMockAuthAndOtp(mockOtpService);
    var client = factory.CreateClient(new WebApplicationFactoryClientOptions { 
      AllowAutoRedirect = false,
      BaseAddress = new Uri("http://acme.localhost/")
    });
    client.DefaultRequestHeaders.Add("X-Gateway-Secret", Environment.GetEnvironmentVariable("GATEWAY_SECRET") ?? "portal-poc-secret-2026");

    var email = $"newstaff_{Guid.NewGuid()}@acme.com";
    var request = new { Email = email, Password = "Password123!", FirstName = "Test", LastName = "Staff" };

    // Act
    var response = await client.PostAsJsonAsync("/api/onboarding/register", request);

    // Assert
    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    var result = await response.Content.ReadFromJsonAsync<RegisterResponse>();
    Assert.NotNull(result);
    var userId = result.UserId;

    // Verify User is in PendingApproval status (Staff)
    using (var scope = factory.Services.CreateScope()) {
      var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
      var user = await userManager.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == userId);
      Assert.NotNull(user);
      Assert.Equal(UserStatus.PendingApproval, user.Status);
    }

    // Verify side-effects (OTP NOT generated yet)
    mockOtpService.Verify(x => x.GenerateAndStoreOtpAsync(userId, It.IsAny<CancellationToken>()), Times.Never);
  }

  [Fact]
  public async Task RegisterCustomer_InvalidEmail_ReturnsBadRequest() {
    // Arrange
    var mockOtpService = new Mock<IOtpService>();
    var factory = CreateFactoryWithMockAuthAndOtp(mockOtpService);
    var client = factory.CreateClient();
    client.DefaultRequestHeaders.Add("X-Gateway-Secret", Environment.GetEnvironmentVariable("GATEWAY_SECRET") ?? "portal-poc-secret-2026");

    var request = new { Email = "not-an-email", Password = "Password123!", FirstName = "Test", LastName = "Customer" };

    // Act
    var response = await client.PostAsJsonAsync("/api/onboarding/register", request);

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
    
    // Create an ACME client (authenticating as Acme host)
    var client = factory.CreateClient(new WebApplicationFactoryClientOptions {
      BaseAddress = new Uri("http://acme.localhost/")
    });
    client.DefaultRequestHeaders.Add("X-Gateway-Secret", Environment.GetEnvironmentVariable("GATEWAY_SECRET") ?? "portal-poc-secret-2026");

    // 1. Seed a user in PendingApproval state in TAI Tenant
    using (var scope = factory.Services.CreateScope()) {
      var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
      var tenantService = scope.ServiceProvider.GetRequiredService<ITenantService>();
      
      // Bypass filters to seed across tenants
      tenantService.SetTenant(new TenantId(Guid.Empty), isGlobalAccess: true);
      
      var email = $"pending_tai_{Guid.NewGuid()}@tai.com";
      var user = new ApplicationUser(email, new TenantId(TaiTenantId)) {
        Email = email,
        EmailConfirmed = true,
      };
      user.StartStaffOnboarding();
      await userManager.CreateAsync(user, "Password123!");
    }

    // Act: Request pending approvals while authenticated on Acme's host.
    // There is a pending user in TAI, but we should not see it.
    var response = await client.GetAsync("/api/onboarding/pending-approvals");

    // Assert: Even though there is a pending user in TAI, the tenant isolation 
    // should prevent ACME from seeing it.
    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    var approvals = await response.Content.ReadFromJsonAsync<List<UserSummaryDto>>();
    Assert.NotNull(approvals);
    
    // Ensure no TAI users leaked into ACME's list
    Assert.All(approvals, u => Assert.DoesNotContain("@tai.com", u.Email));
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
    var response = await client.GetAsync("/api/onboarding/pending-approvals");

    // Assert
    // Using OpenIddict default schemes might return 401
    Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
  }

  [Fact]
  public async Task Verify_ValidCode_ReturnsOk() {
    // Arrange
    var mockOtpService = new Mock<IOtpService>();
    var factory = CreateFactoryWithMockAuthAndOtp(mockOtpService);
    var client = factory.CreateClient(new WebApplicationFactoryClientOptions {
      BaseAddress = new Uri("http://localhost/")
    });
    client.DefaultRequestHeaders.Add("X-Gateway-Secret", Environment.GetEnvironmentVariable("GATEWAY_SECRET") ?? "portal-poc-secret-2026");

    string userId;
    using (var scope = factory.Services.CreateScope()) {
      var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
      var user = new ApplicationUser($"verify_{Guid.NewGuid()}@tai.com", new TenantId(TaiTenantId)) { EmailConfirmed = true };
      user.StartCustomerOnboarding();
      await userManager.CreateAsync(user, "Password123!");
      userId = user.Id;
    }

    mockOtpService.Setup(x => x.ValidateOtpAsync(userId, "123456", It.IsAny<CancellationToken>()))
      .ReturnsAsync(true);

    var request = new { UserId = userId, Code = "123456" };

    // Act
    var response = await client.PostAsJsonAsync("/api/onboarding/verify", request);

    // Assert
    Assert.Equal(HttpStatusCode.OK, response.StatusCode);

    // Verify User is Active in DB
    using (var scope = factory.Services.CreateScope()) {
      var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
      var updatedUser = await userManager.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == userId);
      Assert.NotNull(updatedUser);
      Assert.Equal(UserStatus.Active, updatedUser.Status);
    }
  }

  [Fact]
  public async Task Verify_InvalidCode_ReturnsBadRequest() {
    // Arrange
    var mockOtpService = new Mock<IOtpService>();
    var factory = CreateFactoryWithMockAuthAndOtp(mockOtpService);
    var client = factory.CreateClient(new WebApplicationFactoryClientOptions {
      BaseAddress = new Uri("http://localhost/")
    });
    client.DefaultRequestHeaders.Add("X-Gateway-Secret", Environment.GetEnvironmentVariable("GATEWAY_SECRET") ?? "portal-poc-secret-2026");

    string userId;
    using (var scope = factory.Services.CreateScope()) {
      var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
      var user = new ApplicationUser($"verify_fail_{Guid.NewGuid()}@tai.com", new TenantId(TaiTenantId)) { EmailConfirmed = true };
      user.StartCustomerOnboarding();
      await userManager.CreateAsync(user, "Password123!");
      userId = user.Id;
    }

    mockOtpService.Setup(x => x.ValidateOtpAsync(userId, "000000", It.IsAny<CancellationToken>()))
      .ReturnsAsync(false);

    var request = new { UserId = userId, Code = "000000" };

    // Act
    var response = await client.PostAsJsonAsync("/api/onboarding/verify", request);

    // Assert
    Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    var result = await response.Content.ReadFromJsonAsync<JsonElement>();
    Assert.Contains("Invalid or expired OTP", result.GetProperty("error").GetString());
  }
}
