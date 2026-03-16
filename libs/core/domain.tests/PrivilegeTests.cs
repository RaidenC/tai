using System;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.Enums;
using Tai.Portal.Core.Domain.ValueObjects;
using Xunit;
using FluentAssertions;

namespace Tai.Portal.Core.Domain.Tests;

public class PrivilegeTests {
  [Fact]
  public void Constructor_ShouldInitializeWithValidHierarchicalName() {
    // Arrange
    var name = "Portal.Users.Read";
    var description = "Read user data";
    var module = "Portal";
    var riskLevel = RiskLevel.Low;
    var jitSettings = new JitSettings(TimeSpan.FromHours(1), false, false);

    // Act
    var privilege = new Privilege(name, description, module, riskLevel, jitSettings);

    // Assert
    privilege.Name.Should().Be(name);
    privilege.Description.Should().Be(description);
    privilege.Module.Should().Be(module);
    privilege.RiskLevel.Should().Be(riskLevel);
    privilege.JitSettings.Should().Be(jitSettings);
    privilege.IsActive.Should().BeTrue();
  }

  [Theory]
  [InlineData("")]
  [InlineData(" ")]
  public void Constructor_ShouldThrowArgumentException_WhenNameIsEmpty(string invalidName) {
    // Arrange
    var description = "Description";
    var module = "Module";
    var riskLevel = RiskLevel.Low;
    var jitSettings = new JitSettings(null, false, false);

    // Act
    Action act = () => new Privilege(invalidName, description, module, riskLevel, jitSettings);

    // Assert
    act.Should().Throw<ArgumentException>().WithMessage("Name cannot be empty*");
  }

  [Theory]
  [InlineData("PortalUsersRead")] // No dots
  [InlineData(".Portal.Users.Read")] // Starting with dot
  [InlineData("Portal.Users.Read.")] // Ending with dot
  [InlineData("Portal..Users")] // Double dots
  [InlineData("Portal Users")] // Spaces
  public void Constructor_ShouldThrowArgumentException_WhenNameFormatIsInvalid(string invalidName) {
    // Arrange
    var description = "Description";
    var module = "Module";
    var riskLevel = RiskLevel.Low;
    var jitSettings = new JitSettings(null, false, false);

    // Act
    Action act = () => new Privilege(invalidName, description, module, riskLevel, jitSettings);

    // Assert
    act.Should().Throw<ArgumentException>().WithMessage("*dot notation*");
  }

  [Fact]
  public void SetRiskLevel_ShouldUpdateValue() {
    // Arrange
    var privilege = CreateTestPrivilege();
    var newRiskLevel = RiskLevel.High;

    // Act
    privilege.SetRiskLevel(newRiskLevel);

    // Assert
    privilege.RiskLevel.Should().Be(newRiskLevel);
  }

  [Fact]
  public void Deactivate_ShouldSetIsActiveToFalse() {
    // Arrange
    var privilege = CreateTestPrivilege();

    // Act
    privilege.Deactivate();

    // Assert
    privilege.IsActive.Should().BeFalse();
  }

  [Fact]
  public void AddSupportedScope_ShouldAddScope_WhenNotAlreadyPresent() {
    // Arrange
    var privilege = CreateTestPrivilege();
    var scope = PrivilegeScope.Tenant;

    // Act
    privilege.AddSupportedScope(scope);

    // Assert
    privilege.SupportedScopes.Should().Contain(scope);
    privilege.SupportedScopes.Should().HaveCount(1);
  }

  [Fact]
  public void AddSupportedScope_ShouldNotDuplicate_WhenAlreadyPresent() {
    // Arrange
    var privilege = CreateTestPrivilege();
    var scope = PrivilegeScope.Tenant;
    privilege.AddSupportedScope(scope);

    // Act
    privilege.AddSupportedScope(scope);

    // Assert
    privilege.SupportedScopes.Should().HaveCount(1);
  }

  [Fact]
  public void UpdateMetadata_ShouldUpdateValues() {
    // Arrange
    var privilege = CreateTestPrivilege();
    var newDescription = "New Description";
    var newJitSettings = new JitSettings(TimeSpan.FromMinutes(30), true, true);

    // Act
    privilege.UpdateMetadata(newDescription, newJitSettings);

    // Assert
    privilege.Description.Should().Be(newDescription);
    privilege.JitSettings.Should().Be(newJitSettings);
  }

  private Privilege CreateTestPrivilege() {
    return new Privilege(
      "Portal.Users.Read",
      "Description",
      "Portal",
      RiskLevel.Low,
      new JitSettings(null, false, false)
    );
  }
}
