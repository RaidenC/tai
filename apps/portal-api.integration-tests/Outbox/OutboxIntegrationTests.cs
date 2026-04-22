using System;
using System.Collections.Generic;
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
    var payload = Encoding.UTF8.GetString(got!.Body.ToArray());
    using var doc = JsonDocument.Parse(payload);
    doc.RootElement.GetProperty("userId").GetString().Should().Be("u-1");
    got.BasicProperties.ContentType.Should().Be("application/json");
    got.BasicProperties.DeliveryMode.Should().Be(2);

    // And the row was marked processed.
    using (var scope = _fx.Factory.Services.CreateScope()) {
      var ctx = scope.ServiceProvider.GetRequiredService<PortalDbContext>();
      // Filter to get the most recent processed message from this test
      var row = await ctx.OutboxMessages
        .Where(m => m.ProcessedAt != null && m.Payload.Contains("u-1"))
        .OrderByDescending(m => m.OccurredAt)
        .FirstOrDefaultAsync();
      row.Should().NotNull();
      row!.ProcessedAt.Should().NotBeNull();
      row.RetryCount.Should().Be(0);
    }
  }

  [Fact]
  public async Task SkipLocked_TwoConcurrentReaders_PartitionRowsExclusively() {
    // Seed 100 rows directly via DbContext.
    using (var scope = _fx.Factory.Services.CreateScope()) {
      var ctx = scope.ServiceProvider.GetRequiredService<PortalDbContext>();
      // Wipe any earlier test rows from prior tests in this collection.
      ctx.OutboxMessages.RemoveRange(ctx.OutboxMessages);
      await ctx.SaveChangesAsync();

      for (int i = 0; i < 100; i++) {
        ctx.OutboxMessages.Add(new OutboxMessage {
          Id = Guid.NewGuid(),
          EventType = "test.SkipLockedEvent",
          Payload = $"{{\"i\":{i}}}",
          OccurredAt = DateTimeOffset.UtcNow,
        });
      }
      await ctx.SaveChangesAsync();
    }

    // Two parallel readers each take SKIP LOCKED batches and accumulate IDs.
    async Task<List<Guid>> DrainAsync() {
      var taken = new List<Guid>();
      using var scope = _fx.Factory.Services.CreateScope();
      var ctx = scope.ServiceProvider.GetRequiredService<PortalDbContext>();
      while (true) {
        await using var tx = await ctx.Database.BeginTransactionAsync();
        var batch = await ctx.OutboxMessages
          .FromSqlRaw(@"SELECT * FROM ""OutboxMessages""
                        WHERE ""ProcessedAt"" IS NULL
                        ORDER BY ""OccurredAt""
                        LIMIT 10
                        FOR UPDATE SKIP LOCKED")
          .ToListAsync();
        if (batch.Count == 0) { await tx.CommitAsync(); break; }
        foreach (var m in batch) {
          taken.Add(m.Id);
          m.ProcessedAt = DateTimeOffset.UtcNow;
        }
        await ctx.SaveChangesAsync();
        await tx.CommitAsync();
      }
      return taken;
    }

    var readerA = DrainAsync();
    var readerB = DrainAsync();
    var idsA = await readerA;
    var idsB = await readerB;

    var union = idsA.Concat(idsB).ToList();
    union.Should().HaveCount(100, "every row must be claimed exactly once");
    union.Distinct().Should().HaveCount(100, "no duplicate claims across readers");
    idsA.Intersect(idsB).Should().BeEmpty("disjoint partitioning");
  }

  [Fact]
  public async Task UoWRollback_DiscardsOutbox_AndDoesNotFirePostCommit() {
    // Snapshot baseline counts.
    int baselineOutbox;
    using (var scope = _fx.Factory.Services.CreateScope()) {
      var ctx = scope.ServiceProvider.GetRequiredService<PortalDbContext>();
      baselineOutbox = await ctx.OutboxMessages.CountAsync();
    }

    // Run a UoW that registers a post-commit action and then forces a failure
    // BEFORE tx.CommitAsync — the post-commit action MUST NOT fire and rows
    // MUST NOT persist.
    var postCommitFired = false;
    Exception? thrown = null;
    try {
      using var scope = _fx.Factory.Services.CreateScope();
      var bus = scope.ServiceProvider.GetRequiredService<IMessageBus>();
      var ctx = scope.ServiceProvider.GetRequiredService<PortalDbContext>();
      ctx.RegisterPostCommitAction(_ => { postCommitFired = true; return Task.CompletedTask; });
      await bus.PublishAsync(new { EventName = "RollbackTest" });
      // Force a failure by adding invalid data that will fail on save:
      // Setting EventType to null (which is NOT NULL in DB) will cause DbUpdateException
      ctx.OutboxMessages.Add(new OutboxMessage {
        Id = Guid.NewGuid(),
        EventType = null!, // This should cause a constraint violation
        Payload = "{\"test\":true}",
        OccurredAt = DateTimeOffset.UtcNow,
      });
      await ctx.SaveChangesAsync();
    } catch (Exception ex) {
      thrown = ex;
    }

    thrown.Should().NotBeNull("SaveChangesAsync should throw an exception");
    thrown.Should().BeOfType<DbUpdateException>().OrBeOfType<InvalidOperationException>(),
      "SaveChangesAsync should throw DbUpdateException or InvalidOperationException on failure");

    postCommitFired.Should().BeFalse("post-commit action must not fire on rollback");
    using (var scope = _fx.Factory.Services.CreateScope()) {
      var ctx = scope.ServiceProvider.GetRequiredService<PortalDbContext>();
      (await ctx.OutboxMessages.CountAsync()).Should().Be(baselineOutbox,
        "rollback must discard the outbox row");
    }
  }
}
