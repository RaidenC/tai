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

public class RegisterCustomerCommandHandlerTests {
  private readonly Mock<IIdentityService> _mockIdentityService;
  private readonly Mock<IOtpService> _mockOtpService;
  private readonly RegisterCustomerCommandHandler _handler;
  private readonly RegisterCustomerCommandValidator _validator;

  public RegisterCustomerCommandHandlerTests() {
    _mockIdentityService = new Mock<IIdentityService>();
    _mockOtpService = new Mock<IOtpService>();
    _handler = new RegisterCustomerCommandHandler(_mockIdentityService.Object, _mockOtpService.Object);
    _validator = new RegisterCustomerCommandValidator();
  }

  [Fact]
  public async Task Handle_ValidCommand_CreatesUserAndStartsOnboarding_AndGeneratesOtp() {
    // Arrange
    var tenantId = Guid.NewGuid();
    var command = new RegisterCustomerCommand(tenantId, "test@customer.com", "StrongPassword123!");
    _mockIdentityService
      .Setup(s => s.CreateUserAsync(It.IsAny<ApplicationUser>(), "StrongPassword123!", It.IsAny<CancellationToken>()))
      .ReturnsAsync((true, Array.Empty<string>()))
      .Callback<ApplicationUser, string, CancellationToken>((user, pass, token) => {
        user.Email.Should().Be("test@customer.com");
        user.TenantId.Value.Should().Be(tenantId);
        user.Status.Should().Be(UserStatus.PendingVerification); // Assert Domain logic was called
        user.DomainEvents.Should().ContainSingle(e => e is Tai.Portal.Core.Domain.Events.UserRegisteredEvent); // Assert Event Dispatch
      });

    // Act
    var result = await _handler.Handle(command, CancellationToken.None);

    // Assert
    result.Should().NotBeNullOrEmpty(); // Should return the generated User ID
    _mockIdentityService.Verify(x => x.CreateUserAsync(It.IsAny<ApplicationUser>(), command.Password, It.IsAny<CancellationToken>()), Times.Once);

    // Verify OTP generation was triggered
    _mockOtpService.Verify(x => x.GenerateAndStoreOtpAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
  }

  [Fact]
  public async Task Handle_CreateFails_ThrowsException() {
    // Arrange
    var command = new RegisterCustomerCommand(Guid.NewGuid(), "test@customer.com", "Weak");
    _mockIdentityService.Setup(x => x.CreateUserAsync(It.IsAny<ApplicationUser>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
      .ReturnsAsync((false, new[] { "Password is too weak." }));

    // Act & Assert
    var act = () => _handler.Handle(command, CancellationToken.None);
    await act.Should().ThrowAsync<IdentityValidationException>().WithMessage("Password is too weak.");

    // Verify OTP was NOT generated
    _mockOtpService.Verify(x => x.GenerateAndStoreOtpAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
  }

  [Theory]
  [InlineData("", "test@customer.com", "Password123!", "TenantId")]
  [InlineData("d1e57c6b-2856-4c4f-9e79-88001e9d0db6", "", "Password123!", "Email")]
  [InlineData("d1e57c6b-2856-4c4f-9e79-88001e9d0db6", "invalid-email", "Password123!", "Email")]
  [InlineData("d1e57c6b-2856-4c4f-9e79-88001e9d0db6", "test@customer.com", "", "Password")]
  public void Validator_InvalidInput_ReturnsErrors(string tenantIdStr, string email, string password, string expectedErrorField) {
    // Arrange
    Guid.TryParse(tenantIdStr, out var tenantId);
    var command = new RegisterCustomerCommand(tenantId, email, password);

    // Act
    var result = _validator.Validate(command);

    // Assert
    result.IsValid.Should().BeFalse();
    result.Errors.Should().Contain(e => e.PropertyName == expectedErrorField);
  }
}
