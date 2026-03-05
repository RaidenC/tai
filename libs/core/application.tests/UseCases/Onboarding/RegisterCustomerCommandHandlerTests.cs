using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using FluentValidation;
using MediatR;
using Moq;
using Microsoft.AspNetCore.Identity;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.Enums;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Application.UseCases.Onboarding;
using Xunit;

namespace Tai.Portal.Core.Application.Tests.UseCases.Onboarding;

public class RegisterCustomerCommandHandlerTests {
  private readonly Mock<UserManager<ApplicationUser>> _mockUserManager;
  private readonly RegisterCustomerCommandHandler _handler;
  private readonly RegisterCustomerCommandValidator _validator;

  public RegisterCustomerCommandHandlerTests() {
    var store = new Mock<IUserStore<ApplicationUser>>();
    _mockUserManager = new Mock<UserManager<ApplicationUser>>(store.Object, null, null, null, null, null, null, null, null);
    _handler = new RegisterCustomerCommandHandler(_mockUserManager.Object);
    _validator = new RegisterCustomerCommandValidator();
  }

  [Fact]
  public async Task Handle_ValidCommand_CreatesUserAndStartsOnboarding() {
    // Arrange
    var tenantId = Guid.NewGuid();
    var command = new RegisterCustomerCommand(tenantId, "test@customer.com", "StrongPassword123!");

    _mockUserManager.Setup(x => x.CreateAsync(It.IsAny<ApplicationUser>(), command.Password))
      .ReturnsAsync(IdentityResult.Success)
      .Callback<ApplicationUser, string>((user, pass) => {
        user.Email.Should().Be("test@customer.com");
        user.TenantId.Value.Should().Be(tenantId);
        user.Status.Should().Be(UserStatus.PendingVerification); // Assert Domain logic was called
      });

    // Act
    var result = await _handler.Handle(command, CancellationToken.None);

    // Assert
    result.Should().NotBeNullOrEmpty(); // Should return the generated User ID
    _mockUserManager.Verify(x => x.CreateAsync(It.IsAny<ApplicationUser>(), command.Password), Times.Once);
  }

  [Fact]
  public async Task Handle_CreateFails_ThrowsException() {
    // Arrange
    var command = new RegisterCustomerCommand(Guid.NewGuid(), "test@customer.com", "Weak");
    var error = new IdentityError { Description = "Password too weak" };
    _mockUserManager.Setup(x => x.CreateAsync(It.IsAny<ApplicationUser>(), It.IsAny<string>()))
      .ReturnsAsync(IdentityResult.Failed(error));

    // Act & Assert
    var act = () => _handler.Handle(command, CancellationToken.None);
    await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*Password too weak*");
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
