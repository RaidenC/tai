using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Moq;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Application.UseCases.Users;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.Enums;
using Tai.Portal.Core.Domain.ValueObjects;
using Xunit;

namespace Tai.Portal.Core.Application.Tests.UseCases.Users;

public class GetUsersQueryHandlerTests {
  private readonly Mock<IIdentityService> _mockIdentityService;
  private readonly GetUsersQueryHandler _handler;

  public GetUsersQueryHandlerTests() {
    _mockIdentityService = new Mock<IIdentityService>();
    _handler = new GetUsersQueryHandler(_mockIdentityService.Object);
  }

  [Fact]
  public async Task Handle_ReturnsMappedUserDtos() {
    // Arrange
    var tenantId = Guid.NewGuid();
    var query = new GetUsersQuery(tenantId);
    var user1 = new ApplicationUser("user1@tai.com", new TenantId(tenantId)) { Id = "1" };
    user1.StartCustomerOnboarding();
    user1.ActivateAccount(); // Active

    var user2 = new ApplicationUser("user2@tai.com", new TenantId(tenantId)) { Id = "2" };
    user2.StartCustomerOnboarding(); // PendingVerification

    var users = new List<ApplicationUser> { user1, user2 };

    _mockIdentityService
      .Setup(s => s.GetUsersByTenantAsync(It.IsAny<TenantId>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
      .ReturnsAsync(users);

    _mockIdentityService
      .Setup(s => s.CountUsersByTenantAsync(It.IsAny<TenantId>(), It.IsAny<CancellationToken>()))
      .ReturnsAsync(2);

    // Act
    var result = await _handler.Handle(query, CancellationToken.None);

    // Assert
    result.Items.Should().HaveCount(2);
    result.TotalCount.Should().Be(2);
    result.Page.Should().Be(1);
    result.PageSize.Should().Be(10);

    result.Items[0].Id.Should().Be("1");
    result.Items[0].Email.Should().Be("user1@tai.com");
    result.Items[0].Status.Should().Be("Active");

    result.Items[1].Id.Should().Be("2");
    result.Items[1].Email.Should().Be("user2@tai.com");
    result.Items[1].Status.Should().Be("PendingVerification");

    _mockIdentityService.Verify(s => s.GetUsersByTenantAsync(
      It.Is<TenantId>(t => t.Value == tenantId),
      0,
      10,
      It.IsAny<CancellationToken>()), Times.Once);
  }

  [Fact]
  public async Task Handle_CalculatesSkipCorrectlyForPagination() {
    // Arrange
    var tenantId = Guid.NewGuid();
    var query = new GetUsersQuery(tenantId, Page: 3, PageSize: 5);
    _mockIdentityService
      .Setup(s => s.GetUsersByTenantAsync(It.IsAny<TenantId>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
      .ReturnsAsync(new List<ApplicationUser>());

    _mockIdentityService
      .Setup(s => s.CountUsersByTenantAsync(It.IsAny<TenantId>(), It.IsAny<CancellationToken>()))
      .ReturnsAsync(0);

    // Act
    await _handler.Handle(query, CancellationToken.None);

    // Assert: (3-1) * 5 = 10
    _mockIdentityService.Verify(s => s.GetUsersByTenantAsync(
      It.IsAny<TenantId>(),
      10,
      5,
      It.IsAny<CancellationToken>()), Times.Once);
  }
}
