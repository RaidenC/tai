using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Moq;
using Tai.Portal.Core.Infrastructure.Middleware;
using Xunit;

namespace Tai.Portal.Core.Infrastructure.Tests;

public class GatewayTrustMiddlewareTests {
  private readonly string _secret = "portal-poc-secret-2026";

  [Fact]
  public async Task InvokeAsync_ShouldAllow_WhenSecretMatches() {
    // Arrange
    var context = new DefaultHttpContext();
    context.Request.Headers["X-Gateway-Secret"] = _secret;

    var nextMock = new Mock<RequestDelegate>();
    var configMock = new Mock<IConfiguration>();
    configMock.Setup(c => c["GATEWAY_SECRET"]).Returns(_secret);
    configMock.Setup(c => c["Gateway:Secret"]).Returns(_secret);

    var middleware = new GatewayTrustMiddleware(nextMock.Object, configMock.Object);

    // Act
    await middleware.InvokeAsync(context);

    // Assert
    nextMock.Verify(n => n(context), Times.Once);
    context.Response.StatusCode.Should().Be(StatusCodes.Status200OK);
  }

  [Fact]
  public async Task InvokeAsync_ShouldReject_WhenSecretIsMissing() {
    // Arrange
    var context = new DefaultHttpContext();

    var nextMock = new Mock<RequestDelegate>();
    var configMock = new Mock<IConfiguration>();
    configMock.Setup(c => c["GATEWAY_SECRET"]).Returns(_secret);
    configMock.Setup(c => c["Gateway:Secret"]).Returns(_secret);

    var middleware = new GatewayTrustMiddleware(nextMock.Object, configMock.Object);

    // Act
    await middleware.InvokeAsync(context);

    // Assert
    nextMock.Verify(n => n(context), Times.Never);
    context.Response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
  }

  [Fact]
  public async Task InvokeAsync_ShouldReject_WhenSecretIsWrong() {
    // Arrange
    var context = new DefaultHttpContext();
    context.Request.Headers["X-Gateway-Secret"] = "WRONG";

    var nextMock = new Mock<RequestDelegate>();
    var configMock = new Mock<IConfiguration>();
    configMock.Setup(c => c["GATEWAY_SECRET"]).Returns(_secret);
    configMock.Setup(c => c["Gateway:Secret"]).Returns(_secret);

    var middleware = new GatewayTrustMiddleware(nextMock.Object, configMock.Object);

    // Act
    await middleware.InvokeAsync(context);

    // Assert
    nextMock.Verify(n => n(context), Times.Never);
    context.Response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
  }
}
