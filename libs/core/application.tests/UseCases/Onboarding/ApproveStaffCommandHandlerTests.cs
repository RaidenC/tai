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

public class ApproveStaffCommandHandlerTests {
  private readonly Mock<UserManager<ApplicationUser>> _mockUserManager;
  private readonly ApproveStaffCommandHandler _handler;
  private readonly ApproveStaffCommandValidator _validator;

  public ApproveStaffCommandHandlerTests() {
    var store = new Mock<IUserStore<ApplicationUser>>();
    _mockUserManager = new Mock<UserManager<ApplicationUser>>(store.Object, null, null, null, null, null, null, null, null);
    _handler = new ApproveStaffCommandHandler(_mockUserManager.Object);
    _validator = new ApproveStaffCommandValidator();
  }

  [Fact]
  public async Task Handle_ValidCommand_ApprovesUser() {
    // Arrange
    var userId = "target_user_id";
    var adminId = "admin_user_id";
    var command = new ApproveStaffCommand(userId, adminId);
    
    // Create a user in the correct state
    var userToApprove = new ApplicationUser("staff@bank.com", (TenantId)Guid.NewGuid());
    userToApprove.StartStaffOnboarding(); // Moves to PendingApproval
    
    _mockUserManager.Setup(x => x.FindByIdAsync(userId)).ReturnsAsync(userToApprove);
    _mockUserManager.Setup(x => x.UpdateAsync(userToApprove)).ReturnsAsync(IdentityResult.Success);

    // Act
    await _handler.Handle(command, CancellationToken.None);

    // Assert
    userToApprove.Status.Should().Be(UserStatus.PendingVerification);
    _mockUserManager.Verify(x => x.UpdateAsync(userToApprove), Times.Once);
  }

  [Fact]
  public async Task Handle_UserNotFound_ThrowsException() {
    // Arrange
    var command = new ApproveStaffCommand("non_existent_id", "admin_id");
    _mockUserManager.Setup(x => x.FindByIdAsync(It.IsAny<string>())).ReturnsAsync((ApplicationUser)null);

    // Act & Assert
    var act = () => _handler.Handle(command, CancellationToken.None);
    await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*not found*");
  }

  [Theory]
  [InlineData("", "admin_id", "TargetUserId")]
  [InlineData("user_id", "", "ApprovedByAdminId")]
  public void Validator_InvalidInput_ReturnsErrors(string targetId, string adminId, string expectedErrorField) {
    // Arrange
    var command = new ApproveStaffCommand(targetId, adminId);

    // Act
    var result = _validator.Validate(command);

    // Assert
    result.IsValid.Should().BeFalse();
    result.Errors.Should().Contain(e => e.PropertyName == expectedErrorField);
  }
}
