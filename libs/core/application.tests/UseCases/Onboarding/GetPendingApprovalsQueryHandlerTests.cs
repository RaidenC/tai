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
  public async Task Handle_ShouldReturnOnly_UsersInPendingApprovalState_ForSpecificTenant() {
    // Arrange
    var tenantIdA = (TenantId)Guid.NewGuid();
    var tenantIdB = (TenantId)Guid.NewGuid();

    // 1. Created State (Should NOT be returned)
    var user1 = new ApplicationUser("user1@test.com", tenantIdA) { Id = "id1" };

    // 2. Pending Approval State for Tenant A (SHOULD be returned)
    var user2 = new ApplicationUser("user2@test.com", tenantIdA) { Id = "id2", Email = "user2@test.com" };
    user2.StartStaffOnboarding();

    // 3. Pending Approval State for Tenant B (Should NOT be returned - isolation)
    var user3 = new ApplicationUser("user3@test.com", tenantIdB) { Id = "id3" };
    user3.StartStaffOnboarding();

    // Setup the mock to return an IQueryable of these users
    var usersList = new List<ApplicationUser> { user1, user2, user3 }.AsQueryable();
    _mockUserManager.Setup(x => x.Users).Returns(usersList);

    var query = new GetPendingApprovalsQuery(tenantIdA.Value);

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
  public async Task Handle_Pagination_ShouldReturnCorrectSubset() {
    // Arrange
    var tenantId = (TenantId)Guid.NewGuid();
    var usersList = Enumerable.Range(1, 15).Select(i => {
      var user = new ApplicationUser($"user{i}@test.com", tenantId) { Id = $"id{i}" };
      user.StartStaffOnboarding();
      return user;
    }).ToList();

    _mockUserManager.Setup(x => x.Users).Returns(usersList.AsQueryable());

    // Page 1, Size 10
    var queryPage1 = new GetPendingApprovalsQuery(tenantId.Value, 1, 10);
    var resultPage1 = await _handler.Handle(queryPage1, CancellationToken.None);
    resultPage1.Should().HaveCount(10);
    resultPage1.First().Id.Should().Be("id1");

    // Page 2, Size 10
    var queryPage2 = new GetPendingApprovalsQuery(tenantId.Value, 2, 10);
    var resultPage2 = await _handler.Handle(queryPage2, CancellationToken.None);
    resultPage2.Should().HaveCount(5);
    resultPage2.First().Id.Should().Be("id11");
  }

  [Fact]
  public async Task Handle_WhenNoPendingUsers_ShouldReturnEmptyList() {
    // Arrange
    var tenantId = (TenantId)Guid.NewGuid();
    var user1 = new ApplicationUser("user1@test.com", tenantId) { Id = "id1" }; // Status: Created

    var usersList = new List<ApplicationUser> { user1 }.AsQueryable();
    _mockUserManager.Setup(x => x.Users).Returns(usersList);

    var query = new GetPendingApprovalsQuery(tenantId.Value);

    // Act
    var result = await _handler.Handle(query, CancellationToken.None);

    // Assert
    result.Should().NotBeNull();
    result.Should().BeEmpty();
  }
}
