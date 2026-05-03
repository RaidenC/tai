using FluentAssertions;
using Microsoft.AspNetCore.SignalR;
using Moq;
using System;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Tai.Portal.Api.Hubs;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Domain.ValueObjects;
using Xunit;

namespace Tai.Portal.Core.Infrastructure.Tests.Services;

public class NotificationHubTests {
  [Fact]
  public async Task OnConnectedAsync_AddsConnectionToResolvedTenantGroup() {
    var tenantId = new TenantId(Guid.Parse("00000000-0000-0000-0000-000000000002"));
    var tenantServiceMock = new Mock<ITenantService>();
    tenantServiceMock.Setup(s => s.TenantId).Returns(tenantId);

    var contextMock = new Mock<HubCallerContext>();
    contextMock.Setup(c => c.ConnectionId).Returns("connection-1");
    contextMock.Setup(c => c.User).Returns(new ClaimsPrincipal(new ClaimsIdentity(new[] {
      new Claim(ClaimTypes.NameIdentifier, "user-1")
    }, "TestAuth")));

    var groupsMock = new Mock<IGroupManager>();
    groupsMock
      .Setup(g => g.AddToGroupAsync(
        It.IsAny<string>(),
        It.IsAny<string>(),
        It.IsAny<CancellationToken>()))
      .Returns(Task.CompletedTask);

    var hub = new NotificationHub(tenantServiceMock.Object) {
      Context = contextMock.Object,
      Groups = groupsMock.Object
    };

    await hub.OnConnectedAsync();

    groupsMock.Verify(g => g.AddToGroupAsync(
      "connection-1",
      tenantId.Value.ToString(),
      It.IsAny<CancellationToken>()), Times.Once);

    groupsMock.Invocations.Should().NotContain(i =>
      i.Method.Name == nameof(IGroupManager.AddToGroupAsync)
      && i.Arguments.Count >= 2
      && i.Arguments[1] != null
      && string.Equals(i.Arguments[1].ToString(), "user-1", StringComparison.Ordinal),
      "security notifications are sent to tenant groups, not user id groups");
  }
}
