using System;
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

public class GetUserByIdQueryHandlerTests {
  private readonly Mock<IIdentityService> _mockIdentityService;
  private readonly GetUserByIdQueryHandler _handler;

  public GetUserByIdQueryHandlerTests() {
    _mockIdentityService = new Mock<IIdentityService>();
    _handler = new GetUserByIdQueryHandler(_mockIdentityService.Object);
  }

  [Fact]
  public async Task Handle_UserExists_ReturnsMappedDto() {
    // Arrange
    var userId = Guid.NewGuid().ToString();
    var user = new ApplicationUser("test@test.com", new TenantId(Guid.NewGuid())) {
      FirstName = "John",
      LastName = "Doe",
      RowVersion = 123
    };

    _mockIdentityService.Setup(s => s.GetUserByIdAsync(userId, It.IsAny<CancellationToken>()))
      .ReturnsAsync(user);

    var query = new GetUserByIdQuery(userId);

    // Act
    var result = await _handler.Handle(query, CancellationToken.None);

    // Assert
    result.Should().NotBeNull();
    result!.FirstName.Should().Be("John");
    result.LastName.Should().Be("Doe");
    result.RowVersion.Should().Be(123);
  }

  [Fact]
  public async Task Handle_UserMissing_ReturnsNull() {
    // Arrange
    _mockIdentityService.Setup(s => s.GetUserByIdAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
      .ReturnsAsync((ApplicationUser?)null);

    var query = new GetUserByIdQuery("missing");

    // Act
    var result = await _handler.Handle(query, CancellationToken.None);

    // Assert
    result.Should().BeNull();
  }
}
