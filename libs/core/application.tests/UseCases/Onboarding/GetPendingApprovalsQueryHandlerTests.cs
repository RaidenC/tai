using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Moq;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.Enums;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Application.UseCases.Onboarding;
using Xunit;

namespace Tai.Portal.Core.Application.Tests.UseCases.Onboarding;

public class GetPendingApprovalsQueryHandlerTests {
  private readonly Mock<UserManager<ApplicationUser>> _mockUserManager;
  private readonly GetPendingApprovalsQueryHandler _handler;

  public GetPendingApprovalsQueryHandlerTests() {
    var store = new Mock<IUserStore<ApplicationUser>>();
    _mockUserManager = new Mock<UserManager<ApplicationUser>>(store.Object, null, null, null, null, null, null, null, null);
    _handler = new GetPendingApprovalsQueryHandler(_mockUserManager.Object);
  }

  [Fact]
  public async Task Handle_ShouldReturnOnly_UsersInPendingApprovalState() {
    // Arrange
    var tenantId = (TenantId)Guid.NewGuid();

    // 1. Created State (Should NOT be returned)
    var user1 = new ApplicationUser("user1@test.com", tenantId) { Id = "id1" };

    // 2. Pending Approval State (SHOULD be returned)
    var user2 = new ApplicationUser("user2@test.com", tenantId) { Id = "id2", Email = "user2@test.com" };
    user2.StartStaffOnboarding();

    // 3. Active State (Should NOT be returned)
    var user3 = new ApplicationUser("user3@test.com", tenantId) { Id = "id3" };
    user3.StartCustomerOnboarding();
    user3.ActivateAccount();

    // Setup the mock to return an IQueryable of these users
    var usersList = new List<ApplicationUser> { user1, user2, user3 }.AsQueryable();
    _mockUserManager.Setup(x => x.Users).Returns(usersList);

    var query = new GetPendingApprovalsQuery();

    // Act
    var result = await _handler.Handle(query, CancellationToken.None);

    // Assert
    result.Should().NotBeNull();
    result.Should().HaveCount(1);

    var returnedUser = result.First();
    returnedUser.Id.Should().Be("id2");
    returnedUser.Email.Should().Be("user2@test.com");
    returnedUser.Status.Should().Be(UserStatus.PendingApproval);
  }

  [Fact]
  public async Task Handle_WhenNoPendingUsers_ShouldReturnEmptyList() {
    // Arrange
    var tenantId = (TenantId)Guid.NewGuid();
    var user1 = new ApplicationUser("user1@test.com", tenantId) { Id = "id1" }; // Status: Created

    var usersList = new List<ApplicationUser> { user1 }.AsQueryable();
    _mockUserManager.Setup(x => x.Users).Returns(usersList);

    var query = new GetPendingApprovalsQuery();

    // Act
    var result = await _handler.Handle(query, CancellationToken.None);

    // Assert
    result.Should().NotBeNull();
    result.Should().BeEmpty();
  }
}
