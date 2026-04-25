using System.Threading;
using System.Threading.Tasks;

namespace Tai.Portal.Core.Application.Interfaces;

/// <summary>
/// Publishes a single outbox message to a message broker.
/// Implementations are broker-specific (RabbitMQ in Stage 1B; SNS / SQS / EventBridge / Kafka are future Stage-2 swaps).
/// </summary>
/// <remarks>
/// JUNIOR RATIONALE (broker swap point):
/// IMessageBus is the OUTBOX write point — same regardless of broker.
/// IIntegrationEventPublisher is the BROKER point — what changes when we
/// move from RabbitMQ to AWS SNS/SQS or Kafka. Splitting these means a
/// broker swap is a single class + DI registration change; the outbox,
/// worker loop, retry logic, and SKIP-LOCKED machinery all stay the same.
/// </remarks>
public interface IIntegrationEventPublisher {
  Task PublishAsync(
    Guid messageId,
    string eventType,
    string payload,
    string? correlationId,
    CancellationToken cancellationToken);
}
