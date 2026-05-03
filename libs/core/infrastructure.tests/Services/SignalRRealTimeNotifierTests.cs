using FluentAssertions;
using Microsoft.AspNetCore.SignalR;
using Moq;
using System.Threading;
using System.Threading.Tasks;
using Tai.Portal.Api.Hubs;
using Tai.Portal.Api.Services;
using Xunit;

namespace Tai.Portal.Core.Infrastructure.Tests.Services;

public class SignalRRealTimeNotifierTests {
  [Fact]
  public async Task SendSecurityEventAsync_SendsOnlyToTenantGroup() {
    var groupClientProxyMock = new Mock<IClientProxy>();
    groupClientProxyMock
      .Setup(p => p.SendCoreAsync(
        "SecurityEvent",
        It.IsAny<object?[]>(),
        It.IsAny<CancellationToken>()))
      .Returns(Task.CompletedTask);

    var allClientProxyMock = new Mock<IClientProxy>();
    allClientProxyMock
      .Setup(p => p.SendCoreAsync(
        It.IsAny<string>(),
        It.IsAny<object?[]>(),
        It.IsAny<CancellationToken>()))
      .Returns(Task.CompletedTask);

    var clientsMock = new Mock<IHubClients>();
    clientsMock.Setup(c => c.Group("tenant-1")).Returns(groupClientProxyMock.Object);
    clientsMock.Setup(c => c.All).Returns(allClientProxyMock.Object);

    var hubContextMock = new Mock<IHubContext<NotificationHub>>();
    hubContextMock.Setup(c => c.Clients).Returns(clientsMock.Object);

    var notifier = new SignalRRealTimeNotifier(hubContextMock.Object);

    await notifier.SendSecurityEventAsync(
      "tenant-1",
      "PrivilegeChange",
      new { EventId = "event-1" });

    clientsMock.Verify(c => c.Group("tenant-1"), Times.Once);
    groupClientProxyMock.Verify(p => p.SendCoreAsync(
      "SecurityEvent",
      It.IsAny<object?[]>(),
      It.IsAny<CancellationToken>()), Times.Once);

    allClientProxyMock.Invocations.Should().BeEmpty(
      "security events must not be broadcast to every tenant");
  }
}
