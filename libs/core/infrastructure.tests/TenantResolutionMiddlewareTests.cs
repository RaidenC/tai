using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Moq;
using System;
using System.Threading.Tasks;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Infrastructure.Middleware;
using Tai.Portal.Core.Infrastructure.Persistence;
using Tai.Portal.Core.Application.Services;
using Xunit;

namespace Tai.Portal.Core.Infrastructure.Tests;

public class TenantResolutionMiddlewareTests {
  [Fact]
  public async Task InvokeAsync_ShouldResolveTenant_BasedOnHostHeader() {
    // Arrange
    var tenantId = new TenantId(Guid.NewGuid());
    var host = "tenant1.portal.com";

    var context = new DefaultHttpContext();
    context.Request.Host = new HostString(host);
    context.Request.Headers["X-Gateway-Secret"] = "portal-poc-secret-2026";

    var nextMock = new Mock<RequestDelegate>();
    var tenantServiceMock = new Mock<ITenantService>();
    var cacheMock = new Mock<IMemoryCache>();

    // Setup Cache mock to return nothing (miss)
    object? cacheEntry = null;
    cacheMock.Setup(m => m.TryGetValue(It.IsAny<object>(), out cacheEntry)).Returns(false);
    cacheMock.Setup(m => m.CreateEntry(It.IsAny<object>())).Returns(Mock.Of<ICacheEntry>());

    // Setup DbContext with InMemory
    var options = new DbContextOptionsBuilder<PortalDbContext>()
        .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
        .Options;

    using (var dbContext = new PortalDbContext(options, new TenantService(), new Mock<IServiceProvider>().Object)) {
      dbContext.Tenants.Add(new Tenant(tenantId, "Tenant 1", host));
      await dbContext.SaveChangesAsync();
    }

    using (var dbContext = new PortalDbContext(options, new TenantService(), new Mock<IServiceProvider>().Object)) {
      var middleware = new TenantResolutionMiddleware(nextMock.Object, cacheMock.Object);

      // Act
      await middleware.InvokeAsync(context, tenantServiceMock.Object, dbContext);

      // Assert
      tenantServiceMock.Verify(s => s.SetTenant(tenantId, It.IsAny<bool>()), Times.Once);
      nextMock.Verify(n => n(context), Times.Once);
    }
  }
}
