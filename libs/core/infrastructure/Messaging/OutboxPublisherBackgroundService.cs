using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Infrastructure.Persistence;
using Tai.Portal.Core.Infrastructure.Persistence.Entities;

namespace Tai.Portal.Core.Infrastructure.Messaging;

/// <summary>
/// Polls the OutboxMessages table and publishes unprocessed rows to RabbitMQ.
/// Uses SELECT FOR UPDATE SKIP LOCKED so multiple instances can run in parallel
/// without duplicate sends or blocking each other.
/// </summary>
/// <remarks>
/// JUNIOR RATIONALE (BackgroundService and scoped DbContext):
/// IHostedService runs as a singleton, but PortalDbContext is scoped. We
/// CreateAsyncScope() per iteration to get a fresh DbContext, do the work,
/// and dispose. This is the canonical pattern for background work that
/// touches scoped services in ASP.NET Core.
///
/// JUNIOR RATIONALE (Process isolation invariant):
/// This class and its dependencies do NOT reference IHttpContextAccessor,
/// HttpContext, or any controller/middleware types. Future extraction to
/// a standalone .NET Worker project becomes a cut-and-paste operation —
/// no untangling of HTTP coupling.
/// </remarks>
public class OutboxPublisherBackgroundService : BackgroundService {
  private readonly IServiceScopeFactory _scopeFactory;
  private readonly IIntegrationEventPublisher _publisher;
  private readonly OutboxOptions _options;
  private readonly ILogger<OutboxPublisherBackgroundService> _logger;

  public OutboxPublisherBackgroundService(
      IServiceScopeFactory scopeFactory,
      IIntegrationEventPublisher publisher,
      IOptions<OutboxOptions> options,
      ILogger<OutboxPublisherBackgroundService> logger) {
    _scopeFactory = scopeFactory;
    _publisher = publisher;
    _options = options.Value;
    _logger = logger;
  }

  protected override async Task ExecuteAsync(CancellationToken stoppingToken) {
    _logger.LogInformation("Outbox publisher started. Poll interval={Interval}, batch={Batch}",
      _options.PollInterval, _options.BatchSize);

    while (!stoppingToken.IsCancellationRequested) {
      try {
        var processed = await ProcessBatchAsync(stoppingToken);
        if (processed == 0) {
          await Task.Delay(_options.PollInterval, stoppingToken);
        }
        // Full batch -> loop immediately to drain backlog.
      } catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) {
        break;
      } catch (Exception ex) {
        _logger.LogError(ex, "Outbox publisher loop error; backing off");
        await Task.Delay(_options.ErrorBackoff, stoppingToken);
      }
    }

    _logger.LogInformation("Outbox publisher stopping");
  }

  private async Task<int> ProcessBatchAsync(CancellationToken cancellationToken) {
    await using var scope = _scopeFactory.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<PortalDbContext>();
    await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);

    // JUNIOR RATIONALE (SELECT FOR UPDATE SKIP LOCKED):
    // Multiple publisher instances (app replicas, or future extracted workers)
    // can run this loop simultaneously. Without row locking, two workers grab
    // the same row and publish it twice. Without SKIP LOCKED, worker B BLOCKS
    // on worker A's lock until A commits — throughput collapses to single-
    // threaded. SKIP LOCKED tells Postgres: "if someone else holds it, skip
    // and give me the next row." This is THE standard PG pattern for work-
    // queue consumption (same mechanism pgmq and pg_cron's runner use).
    // Postgres is the coordinator — no Redis, no leader election.
    var batch = await db.OutboxMessages
      .FromSqlRaw(@"
        SELECT * FROM ""OutboxMessages""
        WHERE ""ProcessedAt"" IS NULL
        ORDER BY ""OccurredAt""
        LIMIT {0}
        FOR UPDATE SKIP LOCKED", _options.BatchSize)
      .ToListAsync(cancellationToken);

    if (batch.Count == 0) {
      await tx.CommitAsync(cancellationToken);
      return 0;
    }

    foreach (var msg in batch) {
      try {
        await _publisher.PublishAsync(
          msg.Id,
          msg.EventType,
          msg.Payload,
          msg.CorrelationId,
          cancellationToken);
        msg.ProcessedAt = DateTimeOffset.UtcNow;
        msg.Error = null;
      } catch (Exception ex) {
        msg.RetryCount++;
        msg.Error = ex.Message.Length > 2000 ? ex.Message[..2000] : ex.Message;
        // ProcessedAt stays null -> retry on next poll.
        _logger.LogWarning(ex, "Failed to publish outbox message {MessageId} (retry {Retry})",
          msg.Id, msg.RetryCount);
      }
    }

    await db.SaveChangesAsync(cancellationToken);
    await tx.CommitAsync(cancellationToken);
    return batch.Count;
  }
}
