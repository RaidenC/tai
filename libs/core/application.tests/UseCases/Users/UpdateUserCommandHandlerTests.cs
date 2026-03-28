using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Moq;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Application.UseCases.Users;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.Exceptions;
using Tai.Portal.Core.Domain.ValueObjects;
using Xunit;

namespace Tai.Portal.Core.Application.Tests.UseCases.Users;

public class UpdateUserCommandHandlerTests {
  private readonly Mock<IIdentityService> _mockIdentityService;
  private readonly UpdateUserCommandHandler _handler;

  public UpdateUserCommandHandlerTests() {
    _mockIdentityService = new Mock<IIdentityService>();
    _handler = new UpdateUserCommandHandler(_mockIdentityService.Object);
  }

  private void SetRowVersion(ApplicationUser user, uint version) {
    var property = typeof(ApplicationUser).GetProperty(nameof(ApplicationUser.RowVersion));
    property?.SetValue(user, version);
  }

  [Fact]
  public async Task Handle_Success_ShouldUpdateUserAndPrivileges() {
    // Arrange
    var userId = "user-123";
    var tenantId = new TenantId(Guid.NewGuid());
    var rowVersion = 123u;
    var privilegeIds = new List<Guid> { Guid.NewGuid(), Guid.NewGuid() };

    var command = new UpdateUserCommand(
      userId,
      "NewFirst",
      "NewLast",
      "new@email.com",
      rowVersion,
      privilegeIds
    );

    var existingUser = new ApplicationUser("old@email.com", tenantId) {
      Id = userId,
      FirstName = "OldFirst",
      LastName = "OldLast"
    };
    SetRowVersion(existingUser, rowVersion);

    _mockIdentityService
      .Setup(s => s.GetUserByIdAsync(userId, It.IsAny<CancellationToken>()))
      .ReturnsAsync(existingUser);

    _mockIdentityService
      .Setup(s => s.UpdateUserAsync(It.IsAny<ApplicationUser>(), It.IsAny<CancellationToken>()))
      .ReturnsAsync(true);

    _mockIdentityService
      .Setup(s => s.UpdateUserPrivilegesAsync(userId, It.IsAny<IEnumerable<PrivilegeId>>(), It.IsAny<CancellationToken>()))
      .ReturnsAsync(true);

    // Act
    var result = await _handler.Handle(command, CancellationToken.None);

    // Assert
    result.Should().BeTrue();

    existingUser.FirstName.Should().Be("NewFirst");
    existingUser.LastName.Should().Be("NewLast");
    existingUser.Email.Should().Be("new@email.com");
    existingUser.UserName.Should().Be("new@email.com");

    _mockIdentityService.Verify(s => s.UpdateUserAsync(existingUser, It.IsAny<CancellationToken>()), Times.Once);
    _mockIdentityService.Verify(s => s.UpdateUserPrivilegesAsync(
      userId,
      It.Is<IEnumerable<PrivilegeId>>(ids => ids.Count() == 2),
      It.IsAny<CancellationToken>()), Times.Once);
  }

  [Fact]
  public async Task Handle_UserNotFound_ShouldReturnFalse() {
    // Arrange
    var command = new UpdateUserCommand("id", "F", "L", "e@e.com", 1u, new List<Guid>());

    _mockIdentityService
      .Setup(s => s.GetUserByIdAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
      .ReturnsAsync((ApplicationUser?)null);

    // Act
    var result = await _handler.Handle(command, CancellationToken.None);

    // Assert
    result.Should().BeFalse();
  }

  [Fact]
  public async Task Handle_RowVersionMismatch_ShouldThrowConcurrencyException() {
    // Arrange
    var userId = "user-123";
    var rowVersion = 123u;
    var command = new UpdateUserCommand(userId, "F", "L", "e@e.com", rowVersion, new List<Guid>());

    var existingUser = new ApplicationUser("old@email.com", new TenantId(Guid.NewGuid())) {
      Id = userId
    };
    SetRowVersion(existingUser, 456u); // Mismatch

    _mockIdentityService
      .Setup(s => s.GetUserByIdAsync(userId, It.IsAny<CancellationToken>()))
      .ReturnsAsync(existingUser);

    // Act
    var act = () => _handler.Handle(command, CancellationToken.None);

    // Assert
    await act.Should().ThrowAsync<ConcurrencyException>();
  }

  [Fact]
  public async Task Handle_UpdateUserFailure_ShouldReturnFalse() {
    // Arrange
    var userId = "user-123";
    var rowVersion = 123u;
    var command = new UpdateUserCommand(userId, "F", "L", "e@e.com", rowVersion, new List<Guid>());

    var existingUser = new ApplicationUser("old@email.com", new TenantId(Guid.NewGuid())) {
      Id = userId
    };
    SetRowVersion(existingUser, rowVersion);

    _mockIdentityService
      .Setup(s => s.GetUserByIdAsync(userId, It.IsAny<CancellationToken>()))
      .ReturnsAsync(existingUser);

    _mockIdentityService
      .Setup(s => s.UpdateUserAsync(It.IsAny<ApplicationUser>(), It.IsAny<CancellationToken>()))
      .ReturnsAsync(false);

    // Act
    var result = await _handler.Handle(command, CancellationToken.None);

    // Assert
    result.Should().BeFalse();
    _mockIdentityService.Verify(s => s.UpdateUserPrivilegesAsync(It.IsAny<string>(), It.IsAny<IEnumerable<PrivilegeId>>(), It.IsAny<CancellationToken>()), Times.Never);
  }
}
