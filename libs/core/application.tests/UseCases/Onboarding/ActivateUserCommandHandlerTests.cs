using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using FluentValidation;
using Moq;
using Tai.Portal.Core.Application.Exceptions;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.Enums;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Application.UseCases.Onboarding;
using Xunit;

namespace Tai.Portal.Core.Application.Tests.UseCases.Onboarding;

public class ActivateUserCommandHandlerTests {
  private readonly Mock<IIdentityService> _mockIdentityService;
  private readonly Mock<IOtpService> _mockOtpService;
  private readonly ActivateUserCommandHandler _handler;
  private readonly ActivateUserCommandValidator _validator;

  public ActivateUserCommandHandlerTests() {
    _mockIdentityService = new Mock<IIdentityService>();
    _mockOtpService = new Mock<IOtpService>();
    _handler = new ActivateUserCommandHandler(_mockIdentityService.Object, _mockOtpService.Object);
    _validator = new ActivateUserCommandValidator();
  }

  [Fact]
  public async Task Handle_ValidCommand_ActivatesUser() {
    // Arrange
    var userId = "target_user_id";
    var command = new ActivateUserCommand(userId, "123456");

    var userToActivate = new ApplicationUser("customer@bank.com", (TenantId)Guid.NewGuid()) { Id = userId };
    userToActivate.StartCustomerOnboarding();

    _mockIdentityService.Setup(x => x.GetUserByIdAsync(userId, It.IsAny<CancellationToken>())).ReturnsAsync(userToActivate);
    _mockOtpService.Setup(x => x.ValidateOtpAsync(userId, "123456", It.IsAny<CancellationToken>())).ReturnsAsync(true);
    _mockIdentityService.Setup(x => x.UpdateUserAsync(userToActivate, It.IsAny<CancellationToken>())).ReturnsAsync(true);

    // Act
    await _handler.Handle(command, CancellationToken.None);

    // Assert
    userToActivate.Status.Should().Be(UserStatus.Active);
    _mockIdentityService.Verify(x => x.UpdateUserAsync(userToActivate, It.IsAny<CancellationToken>()), Times.Once);
  }

  [Fact]
  public async Task Handle_InvalidOtp_ThrowsException() {
    // Arrange
    var userId = "target_user_id";
    var command = new ActivateUserCommand(userId, "999999");

    var userToActivate = new ApplicationUser("customer@bank.com", (TenantId)Guid.NewGuid()) { Id = userId };
    userToActivate.StartCustomerOnboarding();

    _mockIdentityService.Setup(x => x.GetUserByIdAsync(userId, It.IsAny<CancellationToken>())).ReturnsAsync(userToActivate);
    _mockOtpService.Setup(x => x.ValidateOtpAsync(userId, "999999", It.IsAny<CancellationToken>())).ReturnsAsync(false); // OTP Failed

    // Act & Assert
    var act = () => _handler.Handle(command, CancellationToken.None);
    await act.Should().ThrowAsync<IdentityValidationException>().WithMessage("*Invalid or expired*");
  }

  [Fact]
  public async Task Handle_UserInInvalidState_ThrowsException() {
    // Arrange
    var userId = "target_user_id";
    var command = new ActivateUserCommand(userId, "123456");

    // Create a user in Created state (not ready for activation)
    var userToActivate = new ApplicationUser("customer@bank.com", (TenantId)Guid.NewGuid()) { Id = userId };

    _mockIdentityService.Setup(x => x.GetUserByIdAsync(userId, It.IsAny<CancellationToken>())).ReturnsAsync(userToActivate);
    _mockOtpService.Setup(x => x.ValidateOtpAsync(userId, "123456", It.IsAny<CancellationToken>())).ReturnsAsync(true);

    // Act & Assert
    var act = () => _handler.Handle(command, CancellationToken.None);
    await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*cannot be activated*");
  }

  [Theory]
  [InlineData("", "123456", "UserId")]
  [InlineData("user_id", "", "OtpCode")]
  [InlineData("user_id", "12345", "OtpCode")] // Too short
  public void Validator_InvalidInput_ReturnsErrors(string userId, string otpCode, string expectedErrorField) {
    // Arrange
    var command = new ActivateUserCommand(userId, otpCode);

    // Act
    var result = _validator.Validate(command);

    // Assert
    result.IsValid.Should().BeFalse();
    result.Errors.Should().Contain(e => e.PropertyName == expectedErrorField);
  }
}
