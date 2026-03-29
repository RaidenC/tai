using System;
using Tai.Portal.Core.Domain.Events;
using Tai.Portal.Core.Domain.ValueObjects;
using Xunit;

namespace Tai.Portal.Core.Domain.Tests;

public class SecurityEventTests {
  private static readonly TenantId TestTenantId = new(Guid.NewGuid());
  private const string TestUserId = "user-123";
  private const string TestCorrelationId = "corr-456";

  [Fact]
  public void LoginAnomalyEvent_ShouldBeCorrectlyInstantiated() {
    // Arrange & Act
    var @event = new LoginAnomalyEvent(
        TestTenantId,
        TestUserId,
        "Failed MFA",
        "Multiple failed attempts from IP 1.2.3.4",
        "1.2.3.4",
        TestCorrelationId
    );

    // Assert
    Assert.Equal(TestTenantId, @event.TenantId);
    Assert.Equal(TestUserId, @event.UserId);
    Assert.Equal("Failed MFA", @event.Reason);
    Assert.Equal("Multiple failed attempts from IP 1.2.3.4", @event.Details);
    Assert.Equal("1.2.3.4", @event.IpAddress);
    Assert.Equal(TestCorrelationId, @event.CorrelationId);
    Assert.NotEqual(default, @event.Timestamp);
    Assert.NotEqual(Guid.Empty, @event.EventId);
  }

  [Fact]
  public void PrivilegeChangeEvent_ShouldBeCorrectlyInstantiated() {
    // Arrange & Act
    var @event = new PrivilegeChangeEvent(
        TestTenantId,
        TestUserId,
        "JIT Elevation Approved",
        "Role: Admin, Duration: 2h",
        "Admin",
        TestCorrelationId
    );

    // Assert
    Assert.Equal(TestTenantId, @event.TenantId);
    Assert.Equal(TestUserId, @event.UserId);
    Assert.Equal("JIT Elevation Approved", @event.Action);
    Assert.Equal("Role: Admin, Duration: 2h", @event.Details);
    Assert.Equal("Admin", @event.ResourceId);
    Assert.Equal(TestCorrelationId, @event.CorrelationId);
    Assert.NotEqual(default, @event.Timestamp);
  }

  [Fact]
  public void SecuritySettingChangeEvent_ShouldBeCorrectlyInstantiated() {
    // Arrange & Act
    var @event = new SecuritySettingChangeEvent(
        TestTenantId,
        TestUserId,
        "MFA Disabled",
        "User disabled MFA from settings page",
        "MFA-Settings",
        TestCorrelationId
    );

    // Assert
    Assert.Equal(TestTenantId, @event.TenantId);
    Assert.Equal(TestUserId, @event.UserId);
    Assert.Equal("MFA Disabled", @event.SettingName);
    Assert.Equal("User disabled MFA from settings page", @event.Details);
    Assert.Equal("MFA-Settings", @event.ResourceId);
    Assert.Equal(TestCorrelationId, @event.CorrelationId);
    Assert.NotEqual(default, @event.Timestamp);
  }
}
