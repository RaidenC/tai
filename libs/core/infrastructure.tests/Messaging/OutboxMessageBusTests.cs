using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using System;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Infrastructure.Messaging;
using Tai.Portal.Core.Infrastructure.Persistence;
using Tai.Portal.Core.Infrastructure.Persistence.Entities;
using Testcontainers.PostgreSql;
using Xunit;

namespace Tai.Portal.Core.Infrastructure.Tests.Messaging;

public class OutboxMessageBusTests : IAsyncLifetime {
  private readonly PostgreSqlContainer _pg = new PostgreSqlBuilder("postgres:17").Build();

  public async Task InitializeAsync() => await _pg.StartAsync();
  public async Task DisposeAsync() => await _pg.StopAsync();

  private PortalDbContext NewContext() {
    var opts = new DbContextOptionsBuilder<PortalDbContext>()
      .UseNpgsql(_pg.GetConnectionString())
      .Options;
    var tenantSvc = new Mock<ITenantService>();
    tenantSvc.Setup(s => s.TenantId).Returns(new TenantId(Guid.NewGuid()));
    var ctx = new PortalDbContext(opts, tenantSvc.Object, new Mock<IServiceProvider>().Object);
    ctx.Database.EnsureCreated();
    return ctx;
  }

  private static Mock<ICurrentUserService> Cur(string? correlation = null) {
    var m = new Mock<ICurrentUserService>();
    m.Setup(c => c.CorrelationId).Returns(correlation);
    return m;
  }

  [Fact]
  public async Task PublishAsync_AddsRowToChangeTracker_WithoutSaving() {
    using var ctx = NewContext();
    var bus = new OutboxMessageBus(ctx, Cur("corr-1").Object);

    await bus.PublishAsync(new TestEvent { Name = "abc" });

    ctx.ChangeTracker.Entries<OutboxMessage>().Should().HaveCount(1,
      "PublishAsync must Add but NOT save — the caller's UoW commits");
    var dbCount = await ctx.OutboxMessages.CountAsync();
    dbCount.Should().Be(0, "no SaveChangesAsync was called");
  }

  [Fact]
  public async Task PublishAsync_PersistsCorrectly_WhenCallerSaves() {
    using var ctx = NewContext();
    var bus = new OutboxMessageBus(ctx, Cur("corr-2").Object);

    await bus.PublishAsync(new TestEvent { Name = "persist-me" });
    await ctx.SaveChangesAsync();

    var row = await ctx.OutboxMessages.SingleAsync();
    row.EventType.Should().Contain("TestEvent");
    row.CorrelationId.Should().Be("corr-2");
    row.ProcessedAt.Should().BeNull();
    row.RetryCount.Should().Be(0);

    using var doc = JsonDocument.Parse(row.Payload);
    doc.RootElement.GetProperty("name").GetString().Should().Be("persist-me");
  }

  [Fact]
  public async Task PublishAsync_SerializesConcreteRuntimeType_NotGenericParameter() {
    using var ctx = NewContext();
    var bus = new OutboxMessageBus(ctx, Cur().Object);

    object boxed = new TestEvent { Name = "concrete" };
    await bus.PublishAsync(boxed);
    await ctx.SaveChangesAsync();

    var row = await ctx.OutboxMessages.SingleAsync();
    using var doc = JsonDocument.Parse(row.Payload);
    doc.RootElement.TryGetProperty("name", out var name).Should().BeTrue(
      "must serialize as TestEvent, not as `object` — that classic STJ gotcha drops all properties");
    name.GetString().Should().Be("concrete");
  }

  private class TestEvent {
    public string Name { get; set; } = "";
  }
}
