using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Identity;
using Moq;
using MediatR;
using Tai.Portal.Core.Domain.Events;
using Tai.Portal.Core.Application.Models;
using Tai.Portal.Core.Infrastructure.Persistence.Handlers;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.Enums;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Infrastructure.Persistence;
using Testcontainers.PostgreSql;
using Xunit;
using Xunit.Abstractions;

namespace Tai.Portal.Core.Infrastructure.Tests.Persistence;

public class PrivilegePersistenceTests : IAsyncLifetime {
  private readonly ITestOutputHelper _output;
  private readonly PostgreSqlContainer _postgreSqlContainer = new PostgreSqlBuilder("postgres:17")
      .Build();

  public PrivilegePersistenceTests(ITestOutputHelper output) {
    _output = output;
  }

  public async Task InitializeAsync() {
    await _postgreSqlContainer.StartAsync();
  }

  public async Task DisposeAsync() {
    await _postgreSqlContainer.StopAsync();
  }

  private DbContextOptions<PortalDbContext> CreateOptions() {
    var dataSourceBuilder = new Npgsql.NpgsqlDataSourceBuilder(_postgreSqlContainer.GetConnectionString());
    dataSourceBuilder.EnableDynamicJson();
    var dataSource = dataSourceBuilder.Build();

    return new DbContextOptionsBuilder<PortalDbContext>()
        .UseNpgsql(dataSource)
        .Options;
  }

  [Fact]
  public async Task Privilege_Persistence_ShouldStoreAndRetrieveJsonbFields() {
    // Arrange
    var options = CreateOptions();
    var tenantServiceMock = new Mock<ITenantService>();
    var serviceProviderMock = new Mock<IServiceProvider>();

    var jitSettings = new JitSettings(TimeSpan.FromHours(2), true, true);
    var privilege = new Privilege("Portal.Users.Read", "Description", "Portal", RiskLevel.Low, jitSettings);
    privilege.AddSupportedScope(PrivilegeScope.Tenant);
    privilege.AddSupportedScope(PrivilegeScope.Self);

    // Act
    using (var context = new PortalDbContext(options, tenantServiceMock.Object, serviceProviderMock.Object)) {
      await context.Database.EnsureCreatedAsync();
      context.Privileges.Add(privilege);
      await context.SaveChangesAsync();
    }

    // Assert
    using (var context = new PortalDbContext(options, tenantServiceMock.Object, serviceProviderMock.Object)) {
      var retrieved = await context.Privileges.FirstAsync(p => p.Name == "Portal.Users.Read");

      retrieved.JitSettings.Should().Be(jitSettings);
      retrieved.SupportedScopes.Should().HaveCount(2);
      retrieved.SupportedScopes.Should().Contain(PrivilegeScope.Tenant);
      retrieved.SupportedScopes.Should().Contain(PrivilegeScope.Self);
      retrieved.IsActive.Should().BeTrue();
    }
  }

  [Fact]
  public async Task SeedData_ShouldPopulateInitialPrivileges() {
    // Arrange
    var options = CreateOptions();
    var tenantServiceMock = new Mock<ITenantService>();
    var serviceProviderMock = new Mock<IServiceProvider>();

    using (var context = new PortalDbContext(options, tenantServiceMock.Object, serviceProviderMock.Object)) {
      var serviceScopeMock = new Mock<IServiceScope>();

      // Ensure the scope's service provider returns our mocks and context
      serviceScopeMock.Setup(s => s.ServiceProvider).Returns(serviceProviderMock.Object);

      var serviceScopeFactoryMock = new Mock<IServiceScopeFactory>();
      serviceScopeFactoryMock.Setup(s => s.CreateScope()).Returns(serviceScopeMock.Object);

      // Setup ServiceProvider to handle both GetService and GetRequiredService (via GetService)
      serviceProviderMock.Setup(s => s.GetService(typeof(IServiceScopeFactory))).Returns(serviceScopeFactoryMock.Object);
      serviceProviderMock.Setup(s => s.GetService(typeof(PortalDbContext))).Returns(context);
      serviceProviderMock.Setup(s => s.GetService(typeof(ITenantService))).Returns(tenantServiceMock.Object);

      // We need these for the User/Role/App managers
      var userManagerMock = new Mock<UserManager<ApplicationUser>>(Mock.Of<IUserStore<ApplicationUser>>(), null, null, null, null, null, null, null, null);
      var roleManagerMock = new Mock<RoleManager<IdentityRole>>(Mock.Of<IRoleStore<IdentityRole>>(), null, null, null, null);
      var appManagerMock = new Mock<OpenIddict.Abstractions.IOpenIddictApplicationManager>();

      serviceProviderMock.Setup(s => s.GetService(typeof(UserManager<ApplicationUser>))).Returns(userManagerMock.Object);
      serviceProviderMock.Setup(s => s.GetService(typeof(RoleManager<IdentityRole>))).Returns(roleManagerMock.Object);
      serviceProviderMock.Setup(s => s.GetService(typeof(OpenIddict.Abstractions.IOpenIddictApplicationManager))).Returns(appManagerMock.Object);

      // Mock RoleExistsAsync to return false so it tries to create them
      roleManagerMock.Setup(m => m.RoleExistsAsync(It.IsAny<string>())).ReturnsAsync(false);
      roleManagerMock.Setup(m => m.CreateAsync(It.IsAny<IdentityRole>())).ReturnsAsync(IdentityResult.Success);

      // Ensure schema exists
      await context.Database.EnsureCreatedAsync();

      // Act
      Tai.Portal.Api.SeedData.Initialize(serviceProviderMock.Object, force: true);
    }

    // Assert
    using (var context = new PortalDbContext(options, tenantServiceMock.Object, serviceProviderMock.Object)) {
      var count = await context.Privileges.CountAsync();
      count.Should().BeGreaterOrEqualTo(11, "Should have seeded at least 11 privileges.");

      var inactive = await context.Privileges.IgnoreQueryFilters().FirstAsync(p => p.Name == "LegacyApp.OldFeature.Read");
      inactive.IsActive.Should().BeFalse();

      var wireTransfer = await context.Privileges.FirstAsync(p => p.Name == "Wires.Transfer.Approve");
      wireTransfer.RiskLevel.Should().Be(RiskLevel.High);
      wireTransfer.JitSettings.RequiresJustification.Should().BeTrue();
    }
  }

  [Fact]
  public async Task Privilege_Modification_ShouldPublishTenantAuditOutboxAndSignalRAfterCommit() {
    var options = CreateOptions();
    var tenantId = new TenantId(Guid.Parse("11111111-1111-1111-1111-111111111111"));

    var tenantServiceMock = new Mock<ITenantService>();
    tenantServiceMock.Setup(s => s.TenantId).Returns(tenantId);
    tenantServiceMock.Setup(s => s.IsGlobalAccess).Returns(false);

    var currentUserServiceMock = new Mock<ICurrentUserService>();
    currentUserServiceMock.Setup(s => s.UserId).Returns("admin-user");
    currentUserServiceMock.Setup(s => s.CorrelationId).Returns("corr-privilege-edit");

    var messageBusMock = new Mock<IMessageBus>();
    var realTimeNotifierMock = new Mock<IRealTimeNotifier>();
    var serviceProviderMock = new Mock<IServiceProvider>();
    serviceProviderMock.Setup(s => s.GetService(typeof(ICurrentUserService))).Returns(currentUserServiceMock.Object);

    using (var context = new PortalDbContext(options, tenantServiceMock.Object, serviceProviderMock.Object)) {
      await context.Database.EnsureCreatedAsync();

      var privilege = new Privilege("Event.Test", "Description", "System", RiskLevel.Low, new JitSettings());
      context.Privileges.Add(privilege);
      await context.SaveChangesAsync();

      privilege.SetRiskLevel(RiskLevel.High);

      var handler = new PrivilegeModifiedEventHandler(
        context,
        messageBusMock.Object,
        currentUserServiceMock.Object,
        realTimeNotifierMock.Object);

      var publisherMock = new Mock<IPublisher>();
      publisherMock.Setup(p => p.Publish(It.IsAny<object>(), It.IsAny<CancellationToken>()))
        .Callback<object, CancellationToken>(async (notif, ct) => {
          if (notif is DomainEventNotification<PrivilegeModifiedEvent> pNotif) {
            await handler.Handle(pNotif, ct);
          }
        });
      serviceProviderMock.Setup(s => s.GetService(typeof(IPublisher))).Returns(publisherMock.Object);

      realTimeNotifierMock.Invocations.Should().BeEmpty(
        "SignalR must not fire before SaveChangesAsync commits the transaction");

      await context.SaveChangesAsync();

      var auditLog = await context.AuditLogs
        .IgnoreQueryFilters()
        .FirstOrDefaultAsync(l => l.Action == "PrivilegeModified" && l.ResourceId == privilege.Id.ToString());

      auditLog.Should().NotBeNull();
      auditLog!.TenantId.Should().Be(tenantId);
      auditLog.UserId.Should().Be("admin-user");

      messageBusMock.Verify(m => m.PublishAsync(It.IsAny<object>(), It.IsAny<CancellationToken>()), Times.Once);

      var signalRInvocation = realTimeNotifierMock.Invocations
        .Single(i => i.Method.Name == nameof(IRealTimeNotifier.SendSecurityEventAsync));

      signalRInvocation.Arguments[0].Should().Be(tenantId.Value.ToString());
      signalRInvocation.Arguments[1].Should().Be("PrivilegeChange");

      var payloadJson = System.Text.Json.JsonSerializer.Serialize(signalRInvocation.Arguments[2]);
      payloadJson.Should().Contain(auditLog.Id.ToString());
      payloadJson.Should().Contain("privilege_modified");
    }
  }
}
