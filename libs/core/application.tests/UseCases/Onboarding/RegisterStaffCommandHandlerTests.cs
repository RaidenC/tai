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

public class RegisterStaffCommandHandlerTests {
  private readonly Mock<UserManager<ApplicationUser>> _mockUserManager;
  private readonly RegisterStaffCommandHandler _handler;
  private readonly RegisterStaffCommandValidator _validator;

  public RegisterStaffCommandHandlerTests() {
    var store = new Mock<IUserStore<ApplicationUser>>();
    _mockUserManager = new Mock<UserManager<ApplicationUser>>(store.Object, null, null, null, null, null, null, null, null);
    _handler = new RegisterStaffCommandHandler(_mockUserManager.Object);
    _validator = new RegisterStaffCommandValidator();
  }

  [Fact]
  public async Task Handle_ValidCommand_CreatesUserAndStartsStaffOnboarding() {
    // Arrange
    var tenantId = Guid.NewGuid();
    var command = new RegisterStaffCommand(tenantId, "test@staff.com", "StrongPassword123!");
    
    _mockUserManager.Setup(x => x.CreateAsync(It.IsAny<ApplicationUser>(), command.Password))
      .ReturnsAsync(IdentityResult.Success)
      .Callback<ApplicationUser, string>((user, pass) => {
        user.Email.Should().Be("test@staff.com");
        user.TenantId.Value.Should().Be(tenantId);
        user.Status.Should().Be(UserStatus.PendingApproval); // Assert Domain logic was called for staff
        user.DomainEvents.Should().ContainSingle(e => e is Tai.Portal.Core.Domain.Events.UserRegisteredEvent); // Assert Event Dispatch
      });

    // Act
    var result = await _handler.Handle(command, CancellationToken.None);

    // Assert
    result.Should().NotBeNullOrEmpty(); // Should return the generated User ID
    _mockUserManager.Verify(x => x.CreateAsync(It.IsAny<ApplicationUser>(), command.Password), Times.Once);
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
