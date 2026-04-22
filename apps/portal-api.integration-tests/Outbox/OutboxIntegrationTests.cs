using System;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Infrastructure.Persistence;
using Tai.Portal.Core.Infrastructure.Persistence.Entities;
using Xunit;

namespace portal_api.integration_tests.Outbox;

[Collection("Outbox")]
public class OutboxIntegrationTests {
  private readonly OutboxFixture _fx;
  public OutboxIntegrationTests(OutboxFixture fx) => _fx = fx;

  [Fact]
  public async Task PublishingViaIMessageBus_LandsInRabbit_AfterCommit() {
    // Arrange — bind a test queue to receive any security.* event.
    var (conn, channel, queueName) = _fx.BindTestQueue("security.#");
    using var _conn = conn;
    using var _ch = channel;

    // Use the running app's DI to write through OutboxMessageBus inside a UoW.
    using (var scope = _fx.Factory.Services.CreateScope()) {
      var bus = scope.ServiceProvider.GetRequiredService<IMessageBus>();
      var ctx = scope.ServiceProvider.GetRequiredService<PortalDbContext>();
      await bus.PublishAsync(new {
        EventName = "PrivilegeChange",
        UserId = "u-1",
        At = DateTimeOffset.UtcNow,
      });
      await ctx.SaveChangesAsync();
    }

    // Act — wait for the worker to publish (poll interval 500ms in fixture).
    var deadline = DateTime.UtcNow.AddSeconds(10);
    BasicGetResult? got = null;
    while (DateTime.UtcNow < deadline && got == null) {
      got = channel.BasicGet(queueName, autoAck: true);
      if (got == null) await Task.Delay(100);
    }

    // Assert — message landed.
    got.Should().NotBeNull("publisher worker should have delivered within 10s");
    Encoding.UTF8.GetString(got!.Body.ToArray()).Should().Contain("\"userId\":\"u-1\"");
    got.BasicProperties.ContentType.Should().Be("application/json");
    got.BasicProperties.DeliveryMode.Should().Be(2);

    // And the row was marked processed.
    using (var scope = _fx.Factory.Services.CreateScope()) {
      var ctx = scope.ServiceProvider.GetRequiredService<PortalDbContext>();
      var row = await ctx.OutboxMessages.SingleAsync();
      row.ProcessedAt.Should().NotBeNull();
      row.RetryCount.Should().Be(0);
    }
  }
}
