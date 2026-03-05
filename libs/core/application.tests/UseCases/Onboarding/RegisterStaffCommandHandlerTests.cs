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

public class RegisterStaffCommandHandlerTests {
  private readonly Mock<IIdentityService> _mockIdentityService;
  private readonly Mock<IOtpService> _mockOtpService;
  private readonly RegisterStaffCommandHandler _handler;
  private readonly RegisterStaffCommandValidator _validator;

  public RegisterStaffCommandHandlerTests() {
    _mockIdentityService = new Mock<IIdentityService>();
    _mockOtpService = new Mock<IOtpService>();
    _handler = new RegisterStaffCommandHandler(_mockIdentityService.Object, _mockOtpService.Object);
    _validator = new RegisterStaffCommandValidator();
  }

  [Fact]
  public async Task Handle_ValidCommand_CreatesUserAndStartsStaffOnboarding_NoOtpGeneratedYet() {
    // Arrange
    var tenantId = Guid.NewGuid();
    var command = new RegisterStaffCommand(tenantId, "test@staff.com", "StrongPassword123!");

    _mockIdentityService.Setup(x => x.CreateUserAsync(It.IsAny<ApplicationUser>(), command.Password, It.IsAny<CancellationToken>()))
      .ReturnsAsync(true)
      .Callback<ApplicationUser, string, CancellationToken>((user, pass, token) => {
        user.Email.Should().Be("test@staff.com");
        user.TenantId.Value.Should().Be(tenantId);
        user.Status.Should().Be(UserStatus.PendingApproval); // Assert Domain logic was called for staff
        user.DomainEvents.Should().ContainSingle(e => e is Tai.Portal.Core.Domain.Events.UserRegisteredEvent); // Assert Event Dispatch
      });

    // Act
    var result = await _handler.Handle(command, CancellationToken.None);

    // Assert
    result.Should().NotBeNullOrEmpty(); // Should return the generated User ID
    _mockIdentityService.Verify(x => x.CreateUserAsync(It.IsAny<ApplicationUser>(), command.Password, It.IsAny<CancellationToken>()), Times.Once);

    // Explicitly verify OTP generation was NOT triggered (because they must be approved first)
    _mockOtpService.Verify(x => x.GenerateAndStoreOtpAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
  }

  [Theory]
  [InlineData("", "test@staff.com", "Password123!", "TenantId")]
  [InlineData("d1e57c6b-2856-4c4f-9e79-88001e9d0db6", "", "Password123!", "Email")]
  [InlineData("d1e57c6b-2856-4c4f-9e79-88001e9d0db6", "test@staff.com", "", "Password")]
  public void Validator_InvalidInput_ReturnsErrors(string tenantIdStr, string email, string password, string expectedErrorField) {
    // Arrange
    Guid.TryParse(tenantIdStr, out var tenantId);
    var command = new RegisterStaffCommand(tenantId, email, password);

    // Act
    var result = _validator.Validate(command);

    // Assert
    result.IsValid.Should().BeFalse();
    result.Errors.Should().Contain(e => e.PropertyName == expectedErrorField);
  }
}
