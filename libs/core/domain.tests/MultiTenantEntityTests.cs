using System.Reflection;
using FluentAssertions;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.Interfaces;
using Tai.Portal.Core.Domain.ValueObjects;
using Xunit;

namespace Tai.Portal.Core.Domain.Tests;

public class MultiTenantEntityTests {
  [Fact]
  public void ApplicationUser_ShouldImplement_IMultiTenantEntity() {
    // Arrange
    var tenantId = (TenantId)Guid.NewGuid();
    var user = new ApplicationUser("testuser", tenantId);

    // Act
    var implementsInterface = user is IMultiTenantEntity;

    // Assert
    implementsInterface.Should().BeTrue("ApplicationUser must implement IMultiTenantEntity for data isolation.");
    user.TenantId.Should().Be(tenantId);
    ((IMultiTenantEntity)user).AssociatedTenantId.Should().Be(tenantId);
  }

  [Fact]
  public void ApplicationUser_ShouldThrow_WhenTenantIdIsEmpty() {
    // Act
    Action act = () => new ApplicationUser("testuser", new TenantId(Guid.Empty));

    // Assert
    act.Should().Throw<ArgumentException>().WithMessage("*TenantId*");
  }

  [Fact]
  public void ApplicationUser_ShouldNormalizeEmail() {
    // Arrange
    var user = new ApplicationUser("testuser", (TenantId)Guid.NewGuid());

    // Act
    user.Email = " TEST@Example.Com ";

    // Assert
    user.Email.Should().Be("test@example.com");
  }

  [Fact]
  public void Tenant_ShouldImplement_IMultiTenantEntity() {
    // Arrange
    var tenantId = (TenantId)Guid.NewGuid();
    var tenant = new Tenant(tenantId, "Test Tenant", "test.com");

    // Act
    var implementsInterface = tenant is IMultiTenantEntity;

    // Assert
    implementsInterface.Should().BeTrue("Tenant must implement IMultiTenantEntity for data isolation.");
    ((IMultiTenantEntity)tenant).AssociatedTenantId.Should().Be(tenantId);
    tenant.Name.Should().Be("Test Tenant");
    tenant.TenantHostname.Should().Be("test.com");
    tenant.EnforceMfa.Should().BeFalse();
  }

  [Fact]
  public void Tenant_ShouldThrow_WhenNameIsEmpty() {
    // Act
    Action act = () => new Tenant((TenantId)Guid.NewGuid(), "", "test.com");

    // Assert
    act.Should().Throw<ArgumentException>().WithMessage("*name*");
  }

  [Fact]
  public void Tenant_ShouldUpdateMfaPolicy() {
    // Arrange
    var tenant = new Tenant((TenantId)Guid.NewGuid(), "Test Tenant", "test.com");

    // Act
    tenant.SetMfaPolicy(true);

    // Assert
    tenant.EnforceMfa.Should().BeTrue();
  }

  [Fact]
  public void ApplicationUser_ProtectedConstructor_ShouldWork() {
    // Use reflection to call the protected constructor
    var constructor = typeof(ApplicationUser).GetConstructor(BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public, null, Type.EmptyTypes, null);
    var user = (ApplicationUser)constructor.Invoke(null);
    user.Should().NotBeNull();
  }

  [Fact]
  public void Tenant_PrivateConstructor_ShouldWork() {
    // Use reflection to call the private constructor
    var constructor = typeof(Tenant).GetConstructor(BindingFlags.Instance | BindingFlags.NonPublic, null, Type.EmptyTypes, null);
    var tenant = (Tenant)constructor.Invoke(null);
    tenant.Should().NotBeNull();
  }
}
