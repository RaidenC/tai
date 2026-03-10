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
  public async Task Handle_ValidCommand_CreatesUserAndStartsOnboarding_NoOtpGenerated() {
    // Arrange
    var tenantId = Guid.NewGuid();
    var command = new RegisterStaffCommand(tenantId, "staff@tai.com", "StrongPassword123!", "Test", "Staff");
    _mockIdentityService
      .Setup(s => s.CreateUserAsync(It.IsAny<ApplicationUser>(), "StrongPassword123!", It.IsAny<CancellationToken>()))
      .ReturnsAsync((true, Array.Empty<string>()))
      .Callback<ApplicationUser, string, CancellationToken>((user, pass, token) => {
        user.Email.Should().Be("staff@tai.com");
        user.TenantId.Value.Should().Be(tenantId);
        user.Status.Should().Be(UserStatus.PendingApproval); // Assert Domain logic was called
      });

    // Act
    var result = await _handler.Handle(command, CancellationToken.None);

    // Assert
    result.Should().NotBeNullOrEmpty();
    _mockIdentityService.Verify(x => x.CreateUserAsync(It.IsAny<ApplicationUser>(), command.Password, It.IsAny<CancellationToken>()), Times.Once);

    // Verify OTP generation was NOT triggered for Staff (needs approval first)
    _mockOtpService.Verify(x => x.GenerateAndStoreOtpAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
  }

  [Fact]
  public async Task Handle_CreateFails_ThrowsException() {
    // Arrange
    var command = new RegisterStaffCommand(Guid.NewGuid(), "staff@tai.com", "Weak", "Test", "Staff");
    _mockIdentityService.Setup(x => x.CreateUserAsync(It.IsAny<ApplicationUser>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
      .ReturnsAsync((false, new[] { "Database error" }));

    // Act & Assert
    var act = () => _handler.Handle(command, CancellationToken.None);
    await act.Should().ThrowAsync<IdentityValidationException>();
  }

  [Theory]
  [InlineData("", "staff@tai.com", "Password123!", "FirstName", "LastName", "TenantId")]
  [InlineData("d1e57c6b-2856-4c4f-9e79-88001e9d0db6", "", "Password123!", "FirstName", "LastName", "Email")]
  [InlineData("d1e57c6b-2856-4c4f-9e79-88001e9d0db6", "invalid-email", "Password123!", "FirstName", "LastName", "Email")]
  [InlineData("d1e57c6b-2856-4c4f-9e79-88001e9d0db6", "staff@tai.com", "", "FirstName", "LastName", "Password")]
  [InlineData("d1e57c6b-2856-4c4f-9e79-88001e9d0db6", "staff@tai.com", "Password123!", "", "LastName", "FirstName")]
  [InlineData("d1e57c6b-2856-4c4f-9e79-88001e9d0db6", "staff@tai.com", "Password123!", "FirstName", "", "LastName")]
  public void Validator_InvalidInput_ReturnsErrors(string tenantIdStr, string email, string password, string firstName, string lastName, string expectedErrorField) {
    // Arrange
    Guid.TryParse(tenantIdStr, out var tenantId);
    var command = new RegisterStaffCommand(tenantId, email, password, firstName, lastName);

    // Act
    var result = _validator.Validate(command);

    // Assert
    result.IsValid.Should().BeFalse();
    result.Errors.Should().Contain(e => e.PropertyName == expectedErrorField);
  }
}
