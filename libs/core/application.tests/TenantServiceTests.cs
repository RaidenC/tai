using FluentAssertions;
using Tai.Portal.Core.Application.Services;
using Tai.Portal.Core.Domain.ValueObjects;
using Xunit;

namespace Tai.Portal.Core.Application.Tests;

public class TenantServiceTests {
  [Fact]
  public void SetTenant_ShouldUpdateProperties() {
    // Arrange
    var tenantService = new TenantService();
    var tenantId = new TenantId(Guid.NewGuid());

    // Act
    tenantService.SetTenant(tenantId, true);

    // Assert
    tenantService.TenantId.Should().Be(tenantId);
    tenantService.IsGlobalAccess.Should().BeTrue();
  }

  [Fact]
  public void SetTenant_ShouldWorkWithDefaultIsGlobalAccess() {
    // Arrange
    var tenantService = new TenantService();
    var tenantId = new TenantId(Guid.NewGuid());

    // Act
    tenantService.SetTenant(tenantId);

    // Assert
    tenantService.TenantId.Should().Be(tenantId);
    tenantService.IsGlobalAccess.Should().BeFalse();
  }
}
