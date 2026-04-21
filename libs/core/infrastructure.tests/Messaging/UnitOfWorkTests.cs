using FluentAssertions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Application.Models;
using Tai.Portal.Core.Application.Services;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.Events;
using Tai.Portal.Core.Domain.Interfaces;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Infrastructure.Persistence;
using Testcontainers.PostgreSql;
using Xunit;

namespace Tai.Portal.Core.Infrastructure.Tests.Messaging;

public class UnitOfWorkTests : IAsyncLifetime {
  private readonly PostgreSqlContainer _pg = new PostgreSqlBuilder("postgres:17").Build();

  public async Task InitializeAsync() => await _pg.StartAsync();
  public async Task DisposeAsync() => await _pg.StopAsync();

  private DbContextOptions<PortalDbContext> Options() =>
    new DbContextOptionsBuilder<PortalDbContext>()
      .UseNpgsql(_pg.GetConnectionString())
      .Options;

  private (PortalDbContext ctx, Mock<IPublisher> publisher) NewContext(IServiceProvider? sp = null) {
    var tenantSvc = new Mock<ITenantService>();
    tenantSvc.Setup(s => s.TenantId).Returns(new TenantId(Guid.NewGuid()));
    var publisher = new Mock<IPublisher>();
    publisher.Setup(p => p.Publish(It.IsAny<object>(), It.IsAny<CancellationToken>()))
      .Returns(Task.CompletedTask);
    var spMock = new Mock<IServiceProvider>();
    spMock.Setup(s => s.GetService(typeof(IPublisher))).Returns(publisher.Object);
    spMock.Setup(s => s.GetService(typeof(ICurrentUserService))).Returns(new Mock<ICurrentUserService>().Object);
    var ctx = new PortalDbContext(Options(), tenantSvc.Object, sp ?? spMock.Object, NullLogger<PortalDbContext>.Instance);
    ctx.Database.EnsureCreated();
    return (ctx, publisher);
  }

  [Fact]
  public async Task SaveChangesAsync_DispatchesDomainEvents_AfterFirstBaseSave() {
    var (ctx, publisher) = NewContext();
    var saveCountAtDispatch = -1;
    var saveCount = 0;
    ctx.SavingChanges += (_, _) => saveCount++;

    publisher.Setup(p => p.Publish(It.IsAny<object>(), It.IsAny<CancellationToken>()))
      .Callback<object, CancellationToken>((_, _) => saveCountAtDispatch = saveCount);

    var user = new ApplicationUser("uow1@t.com", new TenantId(Guid.NewGuid()));
    user.StartStaffOnboarding();
    ctx.Users.Add(user);
    await ctx.SaveChangesAsync();
    user.Approve((TenantAdminId)"admin");
    await ctx.SaveChangesAsync();

    saveCountAtDispatch.Should().BeGreaterThan(0,
      "domain events must dispatch AFTER base.SaveChangesAsync, not before");
  }

  [Fact]
  public async Task SaveChangesAsync_CallsBaseSaveTwice_WhenHandlersAddEntries() {
    var (ctx, publisher) = NewContext();
    var saveCount = 0;
    ctx.SavingChanges += (_, _) => saveCount++;

    publisher.Setup(p => p.Publish(It.IsAny<object>(), It.IsAny<CancellationToken>()))
      .Callback<object, CancellationToken>((_, _) => {
        // Simulate a handler adding an audit entry.
        ctx.AuditLogs.Add(new AuditEntry(
          new TenantId(Guid.NewGuid()), "u", "Test", "r", null, null, "d"));
      });

    var user = new ApplicationUser("uow2@t.com", new TenantId(Guid.NewGuid()));
    user.StartStaffOnboarding();
    ctx.Users.Add(user);
    await ctx.SaveChangesAsync();
    user.Approve((TenantAdminId)"admin");
    await ctx.SaveChangesAsync();

    saveCount.Should().BeGreaterThanOrEqualTo(3,
      "two saves for the second SaveChangesAsync (aggregates then audit) plus the first call's save");
  }

  [Fact]
  public async Task PostCommitAction_FiresAfterCommit_OnSuccessfulSave() {
    var (ctx, _) = NewContext();
    var fired = false;
    ctx.RegisterPostCommitAction(_ => { fired = true; return Task.CompletedTask; });

    var user = new ApplicationUser("pca1@t.com", new TenantId(Guid.NewGuid()));
    ctx.Users.Add(user);
    await ctx.SaveChangesAsync();

    fired.Should().BeTrue("post-commit actions must fire after successful commit");
  }

  [Fact]
  public async Task PostCommitAction_DoesNotFire_WhenSaveThrows() {
    var (ctx, publisher) = NewContext();
    var fired = false;
    var callCount = 0;
    publisher.Setup(p => p.Publish(It.IsAny<object>(), It.IsAny<CancellationToken>()))
      .Callback<object, CancellationToken>((_, _) => {
        callCount++;
        if (callCount > 1) {  // Only throw on second call (second SaveChangesAsync)
          ctx.RegisterPostCommitAction(_ => { fired = true; return Task.CompletedTask; });
          throw new InvalidOperationException("handler boom");
        }
      });

    var user = new ApplicationUser("pca2@t.com", new TenantId(Guid.NewGuid()));
    user.StartStaffOnboarding();
    ctx.Users.Add(user);
    await ctx.SaveChangesAsync();
    user.Approve((TenantAdminId)"admin");

    var act = async () => await ctx.SaveChangesAsync();
    await act.Should().ThrowAsync<InvalidOperationException>();
    fired.Should().BeFalse("post-commit actions must NOT fire on rollback");
  }

  [Fact]
  public async Task PostCommitAction_ExceptionIsLogged_NotRethrown() {
    var loggerMock = new Mock<ILogger<PortalDbContext>>();
    var tenantSvc = new Mock<ITenantService>();
    tenantSvc.Setup(s => s.TenantId).Returns(new TenantId(Guid.NewGuid()));
    var ctx = new PortalDbContext(Options(), tenantSvc.Object, new Mock<IServiceProvider>().Object, loggerMock.Object);
    ctx.Database.EnsureCreated();

    ctx.RegisterPostCommitAction(_ => throw new InvalidOperationException("post-commit boom"));

    var user = new ApplicationUser("pca3@t.com", new TenantId(Guid.NewGuid()));
    ctx.Users.Add(user);

    var act = async () => await ctx.SaveChangesAsync();
    await act.Should().NotThrowAsync(
      "post-commit failures must be logged, not rethrown — the DB work already committed");

    loggerMock.Invocations.Should().Contain(i =>
      i.Method.Name == "Log" && i.Arguments.OfType<LogLevel>().Any(l => l == LogLevel.Error));
  }

  [Fact]
  public async Task SaveChangesAsync_InsideCallerTransaction_WithPostCommitAction_Throws() {
    var (ctx, _) = NewContext();
    await using var tx = await ctx.Database.BeginTransactionAsync();

    ctx.RegisterPostCommitAction(_ => Task.CompletedTask);
    var user = new ApplicationUser("nest1@t.com", new TenantId(Guid.NewGuid()));
    ctx.Users.Add(user);

    var act = async () => await ctx.SaveChangesAsync();
    await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*post-commit actions*");
  }
}
