using System;
using System.Linq;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.Enums;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Infrastructure.Tests.Fixtures;
using Xunit;

namespace Tai.Portal.Core.Infrastructure.Tests.Persistence;

[Collection("Database collection")]
public class ApplicationUserPersistenceTests : IAsyncLifetime {
  private readonly DatabaseFixture _fixture;
  private IServiceScope _scope = null!;
  private UserManager<ApplicationUser> _userManager = null!;
  private ITenantService _tenantService = null!;

  public ApplicationUserPersistenceTests(DatabaseFixture fixture) {
    _fixture = fixture;
  }

  public Task InitializeAsync() {
    _scope = _fixture.Factory.Services.CreateScope();
    _userManager = _scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
    _tenantService = _scope.ServiceProvider.GetRequiredService<ITenantService>();
    return Task.CompletedTask;
  }

  public async Task DisposeAsync() {
    _scope.Dispose();
    await _fixture.ResetDatabaseAsync();
  }

  [Fact]
  public async Task CreateUser_ShouldPersistStatusAndAuditTrail() {
    // Arrange
    var tenantId = (TenantId)Guid.NewGuid();
    var adminId = (TenantAdminId)"admin_user_id";
    var user = new ApplicationUser("audit@bank.com", tenantId) { Email = "audit@bank.com" };
    user.StartStaffOnboarding();
    user.Approve(adminId); // Transitions to PendingVerification and sets ApprovedBy

    // Act
    var result = await _userManager.CreateAsync(user, "StrongPassword123!");

    // Assert
    result.Succeeded.Should().BeTrue();

    // Re-fetch from DB to ensure it was actually saved using the unique ID
    var savedUser = await _userManager.FindByIdAsync(user.Id);
    savedUser.Should().NotBeNull();
    savedUser!.Status.Should().Be(UserStatus.PendingVerification);
    savedUser.TenantId.Value.Should().Be(tenantId.Value);
    ((string)savedUser.ApprovedBy!).Should().Be((string)adminId); // Verify Audit Trail
  }

  [Fact]
  public async Task GlobalAccess_ShouldBypassTenantIsolation() {
    // Arrange
    var tenantA = (TenantId)Guid.NewGuid();
    var tenantB = (TenantId)Guid.NewGuid();

    var userA = new ApplicationUser("usera@bank.com", tenantA) { Email = "usera@bank.com" };
    var userB = new ApplicationUser("userb@bank.com", tenantB) { Email = "userb@bank.com" };

    await _userManager.CreateAsync(userA, "Pass123!");
    await _userManager.CreateAsync(userB, "Pass123!");

    // Act - Enable Global Access
    _tenantService.SetTenant(tenantA, isGlobalAccess: true);

    // Query all users. The Global Query Filter should be bypassed.
    var users = _userManager.Users.ToList();

    // Assert
    users.Should().HaveCountGreaterOrEqualTo(2);
    users.Should().Contain(u => u.Email == "usera@bank.com");
    users.Should().Contain(u => u.Email == "userb@bank.com");
  }

  [Fact]
  public async Task CreateUser_WithDuplicateEmailInSameTenant_ShouldFail() {
    // Arrange
    var tenantId = (TenantId)Guid.NewGuid();
    var user1 = new ApplicationUser("dup@bank.com", tenantId) { Email = "dup@bank.com" };
    var user2 = new ApplicationUser("dup@bank.com", tenantId) { Email = "dup@bank.com" };

    await _userManager.CreateAsync(user1, "Pass123!");

    // Act
    var act = () => _userManager.CreateAsync(user2, "Pass123!");

    // Assert
    // JUNIOR RATIONALE: ASP.NET Identity uses SaveChanges internally. 
    // Since our DB unique index is on NormalizedUserName/Email, it will throw a DbUpdateException.
    await act.Should().ThrowAsync<Microsoft.EntityFrameworkCore.DbUpdateException>();
  }

  [Fact]
  public async Task GlobalQueryFilter_ShouldEnforceTenantIsolation() {
    // Arrange
    var tenantA = (TenantId)Guid.NewGuid();
    var tenantB = (TenantId)Guid.NewGuid();

    var userA = new ApplicationUser("usera@bank.com", tenantA) { Email = "usera@bank.com" };
    var userB = new ApplicationUser("userb@bank.com", tenantB) { Email = "userb@bank.com" };

    await _userManager.CreateAsync(userA, "Pass123!");
    await _userManager.CreateAsync(userB, "Pass123!");

    // Act - Set the ambient Tenant context for this scope to Tenant A
    // (We must use reflection or a helper to set the mock tenant ID since it's typically set by middleware)
    _tenantService.SetTenant(tenantA);

    // Query all users. The Global Query Filter should automatically exclude Tenant B.
    var users = _userManager.Users.ToList();

    // Assert
    users.Should().HaveCount(1);
    users.First().Email.Should().Be("usera@bank.com");
  }
}
