using System;
using System.Linq;
using FluentAssertions;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.Enums;
using Tai.Portal.Core.Domain.Events;
using Tai.Portal.Core.Domain.ValueObjects;
using Xunit;

namespace Tai.Portal.Core.Domain.Tests;

public class ApplicationUserTests {
  [Fact]
  public void Create_NewUser_ShouldStartInCreatedState() {
    // Arrange
    var tenantId = (TenantId)Guid.NewGuid();

    // Act
    var user = new ApplicationUser("testuser", tenantId);

    // Assert
    user.Status.Should().Be(UserStatus.Created);
    user.DomainEvents.Should().BeEmpty();
  }

  [Fact]
  public void StartCustomerOnboarding_ShouldTransitionTo_PendingVerification() {
    // Arrange
    var user = new ApplicationUser("customer", (TenantId)Guid.NewGuid());

    // Act
    user.StartCustomerOnboarding();

    // Assert
    user.Status.Should().Be(UserStatus.PendingVerification);
    user.DomainEvents.Should().ContainSingle(e => e is UserRegisteredEvent);
  }

  [Fact]
  public void StartStaffOnboarding_ShouldTransitionTo_PendingApproval() {
    // Arrange
    var user = new ApplicationUser("staff", (TenantId)Guid.NewGuid());

    // Act
    user.StartStaffOnboarding();

    // Assert
    user.Status.Should().Be(UserStatus.PendingApproval);
    user.DomainEvents.Should().ContainSingle(e => e is UserRegisteredEvent);
  }

  [Fact]
  public void ApproveStaffAccount_FromPendingApproval_ShouldTransitionTo_PendingVerification() {
    // Arrange
    var user = new ApplicationUser("staff", (TenantId)Guid.NewGuid());
    user.StartStaffOnboarding();
    user.ClearDomainEvents();

    // Act
    user.ApproveAccount("admin_user_id");

    // Assert
    user.Status.Should().Be(UserStatus.PendingVerification);
    user.DomainEvents.Should().ContainSingle(e => e is UserApprovedEvent);
  }

  [Fact]
  public void ApproveStaffAccount_FromInvalidState_ShouldThrowException() {
    // Arrange
    var user = new ApplicationUser("staff", (TenantId)Guid.NewGuid());
    // User is in Created state, not PendingApproval

    // Act
    Action act = () => user.ApproveAccount("admin_user_id");

    // Assert
    act.Should().Throw<InvalidOperationException>().WithMessage("*cannot be approved*");
  }

  [Fact]
  public void ActivateAccount_FromPendingVerification_ShouldTransitionTo_Active() {
    // Arrange
    var user = new ApplicationUser("customer", (TenantId)Guid.NewGuid());
    user.StartCustomerOnboarding();

    // Act
    user.ActivateAccount();

    // Assert
    user.Status.Should().Be(UserStatus.Active);
  }

  [Fact]
  public void ActivateAccount_FromInvalidState_ShouldThrowException() {
    // Arrange
    var user = new ApplicationUser("staff", (TenantId)Guid.NewGuid());
    // User is in Created state

    // Act
    Action act = () => user.ActivateAccount();

    // Assert
    act.Should().Throw<InvalidOperationException>().WithMessage("*cannot be activated*");
  }

  [Fact]
  public void CanLogin_ShouldBeFalse_WhenNotActive() {
    // Arrange
    var user = new ApplicationUser("user", (TenantId)Guid.NewGuid());

    // Act & Assert
    user.CanLogin().Should().BeFalse();

    user.StartCustomerOnboarding();
    user.CanLogin().Should().BeFalse();
  }

  [Fact]
  public void CanLogin_ShouldBeTrue_WhenActive() {
    // Arrange
    var user = new ApplicationUser("user", (TenantId)Guid.NewGuid());
    user.StartCustomerOnboarding();
    user.ActivateAccount();

    // Act & Assert
    user.CanLogin().Should().BeTrue();
  }
}
