using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Moq;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.Enums;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Application.UseCases.Onboarding;
using Xunit;

namespace Tai.Portal.Core.Application.Tests.UseCases.Onboarding;

public class GetPendingApprovalsQueryHandlerTests {
  private readonly Mock<IIdentityService> _mockIdentityService;
  private readonly GetPendingApprovalsQueryHandler _handler;

  public GetPendingApprovalsQueryHandlerTests() {
    _mockIdentityService = new Mock<IIdentityService>();
    _handler = new GetPendingApprovalsQueryHandler(_mockIdentityService.Object);
  }

  [Fact]
  public async Task Handle_ShouldReturnOnly_UsersInPendingApprovalState_ForSpecificTenant() {
    // Arrange
    var tenantIdA = (TenantId)Guid.NewGuid();
    var tenantIdB = (TenantId)Guid.NewGuid();

    // 2. Pending Approval State for Tenant A (SHOULD be returned)
    var user2 = new ApplicationUser("user2@test.com", tenantIdA) { Id = "id2", Email = "user2@test.com" };
    user2.StartStaffOnboarding();

    var usersList = new List<ApplicationUser> { user2 };

    _mockIdentityService.Setup(x => x.GetUsersByStatusAndTenantAsync(UserStatus.PendingApproval, tenantIdA, 0, 10, It.IsAny<CancellationToken>()))
      .ReturnsAsync(usersList);

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
    var usersList = Enumerable.Range(11, 5).Select(i => {
      var user = new ApplicationUser($"user{i}@test.com", tenantId) { Id = $"id{i}" };
      user.StartStaffOnboarding();
      return user;
    }).ToList();

    _mockIdentityService.Setup(x => x.GetUsersByStatusAndTenantAsync(UserStatus.PendingApproval, tenantId, 10, 10, It.IsAny<CancellationToken>()))
      .ReturnsAsync(usersList);

    // Page 2, Size 10 (Skip 10, Take 10)
    var queryPage2 = new GetPendingApprovalsQuery(tenantId.Value, 2, 10);
    var resultPage2 = await _handler.Handle(queryPage2, CancellationToken.None);
    resultPage2.Should().HaveCount(5);
    resultPage2.First().Id.Should().Be("id11");
  }

  [Fact]
  public async Task Handle_WhenNoPendingUsers_ShouldReturnEmptyList() {
    // Arrange
    var tenantId = (TenantId)Guid.NewGuid();

    _mockIdentityService.Setup(x => x.GetUsersByStatusAndTenantAsync(UserStatus.PendingApproval, tenantId, 0, 10, It.IsAny<CancellationToken>()))
      .ReturnsAsync(new List<ApplicationUser>());

    var query = new GetPendingApprovalsQuery(tenantId.Value);

    // Act
    var result = await _handler.Handle(query, CancellationToken.None);

    // Assert
    result.Should().NotBeNull();
    result.Should().BeEmpty();
  }
}
