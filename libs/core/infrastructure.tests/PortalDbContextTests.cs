using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Moq;
using MediatR;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Infrastructure.Persistence;
using Tai.Portal.Core.Infrastructure.Persistence.Interceptors;
using Tai.Portal.Core.Domain.Interfaces;
using Tai.Portal.Core.Domain.Events;
using Tai.Portal.Core.Application.Services;
using Tai.Portal.Core.Application.Models;
using Testcontainers.PostgreSql;
using Xunit;

namespace Tai.Portal.Core.Infrastructure.Tests;

public class PortalDbContextTests : IAsyncLifetime {
  private readonly PostgreSqlContainer _postgreSqlContainer = new PostgreSqlBuilder("postgres:17")
      .Build();

  public async Task InitializeAsync() {
    await _postgreSqlContainer.StartAsync();
  }

  public async Task DisposeAsync() {
    await _postgreSqlContainer.StopAsync();
  }

  private DbContextOptions<PortalDbContext> CreateOptions() {
    return new DbContextOptionsBuilder<PortalDbContext>()
        .UseNpgsql(_postgreSqlContainer.GetConnectionString())
        .Options;
  }

  [Fact]
  public async Task TenantInterceptor_SavingChangesAsync_ShouldHandleNullContext() {
    // Arrange
    var interceptor = new TenantInterceptor();

    // Act & Assert
    await interceptor.SavingChangesAsync(default, new InterceptionResult<int>());
  }

  [Fact]
  public async Task GlobalQueryFilter_ShouldIsolateData_ByTenantId() {
    // Arrange
    var tenant1Id = new TenantId(Guid.NewGuid());
    var tenant2Id = new TenantId(Guid.NewGuid());

    var tenantServiceMock = new Mock<ITenantService>();
    tenantServiceMock.Setup(s => s.TenantId).Returns(tenant1Id);

    var options = CreateOptions();

    // Seed data for two different tenants
    using (var seedContext = new PortalDbContext(options, new TenantService(), new Mock<IServiceProvider>().Object)) {
      await seedContext.Database.EnsureCreatedAsync();

      var user1 = new ApplicationUser("user1@tenant1.com", tenant1Id);
      var user2 = new ApplicationUser("user2@tenant2.com", tenant2Id);

      seedContext.Users.AddRange(user1, user2);
      await seedContext.SaveChangesAsync();
    }

    using (var context = new PortalDbContext(options, tenantServiceMock.Object, new Mock<IServiceProvider>().Object)) {
      var users = await context.Users.ToListAsync();

      // Assert
      users.Should().HaveCount(1, "Data should be isolated to Tenant 1.");
      users.First().TenantId.Should().Be(tenant1Id);
    }
  }

  [Fact]
  public async Task SaveChangesAsync_ShouldAutomaticallyInject_TenantId() {
    // Arrange
    var tenantId = new TenantId(Guid.NewGuid());
    var tenantServiceMock = new Mock<ITenantService>();
    tenantServiceMock.Setup(s => s.TenantId).Returns(tenantId);

    var options = CreateOptions();

    // Act
    using (var context = new PortalDbContext(options, tenantServiceMock.Object, new Mock<IServiceProvider>().Object)) {
      await context.Database.EnsureCreatedAsync();

      var dummyId = new TenantId(Guid.Parse("FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF"));
      var user = new ApplicationUser("newuser@tenant.com", dummyId);
      context.Users.Add(user);
      await context.SaveChangesAsync();
    }

    // Assert
    using (var context = new PortalDbContext(options, tenantServiceMock.Object, new Mock<IServiceProvider>().Object)) {
      var savedUser = await context.Users.IgnoreQueryFilters().FirstAsync();
      savedUser.TenantId.Should().Be(tenantId, "TenantId should be automatically injected during Save.");
    }
  }

  [Fact]
  public async Task SaveChangesAsync_ShouldDispatchDomainEvents_AndLogApproval() {
    // Arrange
    var tenantId = new TenantId(Guid.NewGuid());
    var tenantServiceMock = new Mock<ITenantService>();
    tenantServiceMock.Setup(s => s.TenantId).Returns(tenantId);

    // We want to use the real dispatcher and handler to verify end-to-end
    var serviceProviderMock = new Mock<IServiceProvider>();
    var options = CreateOptions();

    using (var context = new PortalDbContext(options, tenantServiceMock.Object, serviceProviderMock.Object)) {
      await context.Database.EnsureCreatedAsync();

      // We manually register the handler for this test since we are not using full DI container
      var currentUserServiceMock = new Mock<ICurrentUserService>();
      var handler = new Tai.Portal.Core.Infrastructure.Persistence.Handlers.UserApprovedEventHandler(context, currentUserServiceMock.Object);
      var publisherMock = new Mock<IPublisher>();
      publisherMock.Setup(p => p.Publish(It.IsAny<object>(), It.IsAny<CancellationToken>()))
          .Callback<object, CancellationToken>(async (notif, ct) => {
            if (notif is DomainEventNotification<UserApprovedEvent> approvalNotif) {
              await handler.Handle(approvalNotif, ct);
            }
          });

      serviceProviderMock.Setup(s => s.GetService(typeof(IPublisher))).Returns(publisherMock.Object);

      // 1. Create a user
      var user = new ApplicationUser("test@tenant.com", tenantId);
      user.StartStaffOnboarding();
      context.Users.Add(user);
      await context.SaveChangesAsync();

      // 2. Approve the user
      var adminId = (TenantAdminId)"admin_user_id";
      user.Approve(adminId);

      // Act
      await context.SaveChangesAsync();

      // Assert
      var auditLog = await context.AuditLogs.FirstOrDefaultAsync(l => l.Action == "UserApproved" && l.ResourceId == user.Id);
      auditLog.Should().NotBeNull();
      auditLog!.UserId.Should().Be((string)adminId);
      auditLog.TenantId.Should().Be(tenantId);
    }
  }

  [Fact]
  public async Task SaveChangesAsync_ShouldPopulateAuditFields() {
    // Arrange
    var tenantId = new TenantId(Guid.NewGuid());
    var userId = "test-user-id";

    var tenantServiceMock = new Mock<ITenantService>();
    tenantServiceMock.Setup(s => s.TenantId).Returns(tenantId);

    var currentUserServiceMock = new Mock<ICurrentUserService>();
    currentUserServiceMock.Setup(s => s.UserId).Returns(userId);

    var serviceProviderMock = new Mock<IServiceProvider>();
    serviceProviderMock.Setup(s => s.GetService(typeof(ICurrentUserService))).Returns(currentUserServiceMock.Object);

    var options = CreateOptions();

    using (var context = new PortalDbContext(options, tenantServiceMock.Object, serviceProviderMock.Object)) {
      await context.Database.EnsureCreatedAsync();

      var user = new ApplicationUser("audit-test@tenant.com", tenantId);

      // Act
      context.Users.Add(user);
      await context.SaveChangesAsync();

      // Assert
      user.CreatedAt.Should().BeCloseTo(DateTimeOffset.UtcNow, TimeSpan.FromSeconds(5));
      user.CreatedBy.Should().Be(userId);
      user.LastModifiedAt.Should().BeNull();

      // Act - Update
      user.Email = "updated@tenant.com";
      await context.SaveChangesAsync();

      // Assert - Update
      user.LastModifiedAt.Should().NotBeNull();
      user.LastModifiedAt.Should().BeCloseTo(DateTimeOffset.UtcNow, TimeSpan.FromSeconds(5));
      user.LastModifiedBy.Should().Be(userId);
    }
  }
}
