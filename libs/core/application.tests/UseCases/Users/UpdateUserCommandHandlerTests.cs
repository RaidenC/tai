using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Moq;
using Tai.Portal.Core.Application.Exceptions;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Application.UseCases.Users;
using Tai.Portal.Core.Domain.Entities;
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

  [Fact]
  public async Task Handle_ValidRequest_UpdatesFieldsAndReturnsSuccess() {
    // Arrange
    var userId = Guid.NewGuid().ToString();
    var tenantId = new TenantId(Guid.NewGuid());
    var user = new ApplicationUser("old@test.com", tenantId) {
      Email = "old@test.com",
      FirstName = "Old",
      LastName = "User"
    };

    _mockIdentityService.Setup(s => s.GetUserByIdAsync(userId, It.IsAny<CancellationToken>()))
      .ReturnsAsync(user);
    _mockIdentityService.Setup(s => s.UpdateUserAsync(user, It.IsAny<CancellationToken>()))
      .ReturnsAsync(true);

    var command = new UpdateUserCommand(userId, "new@test.com", "New", "Name");

    // Act
    await _handler.Handle(command, CancellationToken.None);

    // Assert
    user.Email.Should().Be("new@test.com");
    user.FirstName.Should().Be("New");
    user.LastName.Should().Be("Name");
    _mockIdentityService.Verify(s => s.UpdateUserAsync(user, It.IsAny<CancellationToken>()), Times.Once);
  }

  [Fact]
  public async Task Handle_WhenUserNotFound_ThrowsUserNotFoundException() {
    // Arrange
    _mockIdentityService.Setup(s => s.GetUserByIdAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
      .ReturnsAsync((ApplicationUser?)null);

    var command = new UpdateUserCommand("missing", "test@test.com", "First", "Last");

    // Act
    var act = () => _handler.Handle(command, CancellationToken.None);

    // Assert
    await act.Should().ThrowAsync<UserNotFoundException>();
  }

  [Fact]
  public async Task Handle_WithMismatchingRowVersion_ThrowsConcurrencyException() {
    // Arrange
    var userId = Guid.NewGuid().ToString();
    var user = new ApplicationUser("test@test.com", new TenantId(Guid.NewGuid())) {
      RowVersion = 100 // Current version
    };

    _mockIdentityService.Setup(s => s.GetUserByIdAsync(userId, It.IsAny<CancellationToken>()))
      .ReturnsAsync(user);

    var command = new UpdateUserCommand(userId, "test@test.com", "First", "Last", ExpectedRowVersion: 99); // Wrong version

    // Act
    var act = () => _handler.Handle(command, CancellationToken.None);

    // Assert
    await act.Should().ThrowAsync<ConcurrencyException>();
  }
}
