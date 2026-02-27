using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Moq;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Infrastructure.Persistence;
using Tai.Portal.Core.Infrastructure.Persistence.Interceptors;
using Tai.Portal.Core.Domain.Interfaces;
using Tai.Portal.Core.Application.Services;
using Testcontainers.PostgreSql;
using Xunit;

namespace Tai.Portal.Core.Infrastructure.Tests;

public class PortalDbContextTests : IAsyncLifetime {
  private readonly PostgreSqlContainer _postgreSqlContainer = new PostgreSqlBuilder()
      .WithImage("postgres:17")
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
    using (var seedContext = new PortalDbContext(options, new TenantService())) {
      await seedContext.Database.EnsureCreatedAsync();

      var user1 = new ApplicationUser("user1@tenant1.com", tenant1Id);
      var user2 = new ApplicationUser("user2@tenant2.com", tenant2Id);

      seedContext.Users.AddRange(user1, user2);
      await seedContext.SaveChangesAsync();
    }

    using (var context = new PortalDbContext(options, tenantServiceMock.Object)) {
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
    using (var context = new PortalDbContext(options, tenantServiceMock.Object)) {
      await context.Database.EnsureCreatedAsync();

      var dummyId = new TenantId(Guid.Parse("FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF"));
      var user = new ApplicationUser("newuser@tenant.com", dummyId);
      context.Users.Add(user);
      await context.SaveChangesAsync();
    }

    // Assert
    using (var context = new PortalDbContext(options, tenantServiceMock.Object)) {
      var savedUser = await context.Users.IgnoreQueryFilters().FirstAsync();
      savedUser.TenantId.Should().Be(tenantId, "TenantId should be automatically injected during Save.");
    }
  }
}
