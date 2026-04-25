using System;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;
using Tai.Portal.Core.Application.Interfaces;

namespace Tai.Portal.Core.Infrastructure.Messaging;

/// <summary>
/// Publishes OutboxMessages to a RabbitMQ topic exchange using raw RabbitMQ.Client.
/// One channel per publish call (simple; production would pool channels).
/// Uses publisher confirms (WaitForConfirmsOrDie) for at-least-once delivery.
/// </summary>
public class RabbitMqPublisher : IIntegrationEventPublisher {
  private readonly IRabbitMqConnectionProvider _connectionProvider;
  private readonly RabbitMqOptions _options;
  private readonly ILogger<RabbitMqPublisher> _logger;
  private readonly object _exchangeLock = new();
  private bool _exchangeDeclared;

  public RabbitMqPublisher(
      IRabbitMqConnectionProvider connectionProvider,
      IOptions<RabbitMqOptions> options,
      ILogger<RabbitMqPublisher> logger) {
    _connectionProvider = connectionProvider;
    _options = options.Value;
    _logger = logger;
  }

  public Task PublishAsync(
    Guid messageId,
    string eventType,
    string payload,
    string? correlationId,
    CancellationToken cancellationToken) {
    cancellationToken.ThrowIfCancellationRequested();

    using var channel = _connectionProvider.Connection.CreateModel();

    // JUNIOR RATIONALE (Publisher confirms):
    // ConfirmSelect puts the channel into "confirm mode" — every basic.publish
    // gets an acknowledgement (or NACK) from the broker. WaitForConfirmsOrDie
    // BLOCKS until all outstanding publishes are acknowledged or throws on
    // NACK / timeout. Without this, basic.publish is fire-and-forget and a
    // crashed broker silently swallows your messages.
    channel.ConfirmSelect();

    EnsureExchangeDeclared(channel);

    var routingKey = DeriveRoutingKey(eventType);
    var body = Encoding.UTF8.GetBytes(payload);

    var props = channel.CreateBasicProperties();
    props.MessageId = messageId.ToString();
    props.ContentType = "application/json";
    props.DeliveryMode = 2;                  // persistent — survives broker restart
    props.Type = eventType;
    if (!string.IsNullOrEmpty(correlationId)) {
      props.CorrelationId = correlationId;
    }

    channel.BasicPublish(
      exchange: _options.ExchangeName,
      routingKey: routingKey,
      mandatory: false,
      basicProperties: props,
      body: body);

    // JUNIOR RATIONALE (Synchronous confirm for simplicity):
    // For high throughput you'd batch publishes and use the async confirm
    // callbacks. For Stage 1B (one message per publish call from a polling
    // worker), the synchronous wait is the simpler correct choice.
    channel.WaitForConfirmsOrDie(TimeSpan.FromMilliseconds(_options.ConfirmTimeoutMs));

    _logger.LogDebug(
      "Published outbox message {MessageId} to {Exchange} with routing key {RoutingKey}",
      messageId, _options.ExchangeName, routingKey);

    return Task.CompletedTask;
  }

  private void EnsureExchangeDeclared(IModel channel) {
    if (_exchangeDeclared) return;
    lock (_exchangeLock) {
      if (_exchangeDeclared) return;
      // Topic exchange — supports wildcard routing-key bindings on consumers.
      // Durable — survives broker restart.
      channel.ExchangeDeclare(
        exchange: _options.ExchangeName,
        type: ExchangeType.Topic,
        durable: true,
        autoDelete: false);
      _exchangeDeclared = true;
    }
  }

  /// <summary>
  /// Derives "security.privilege-changed"-style routing keys from CLR type names
  /// like "Tai.Portal.Core.Domain.Events.PrivilegeChangeEvent" or anonymous types
  /// like "<>f__AnonymousType0`5".
  /// </summary>
  private static string DeriveRoutingKey(string eventType) {
    // Take only the type name (last segment of the namespace, before any assembly info)
    var simpleName = eventType.Split(',')[0].Split('.').Last();
    if (simpleName.EndsWith("Event", StringComparison.Ordinal)) {
      simpleName = simpleName[..^"Event".Length];
    }

    // PascalCase -> kebab-case: "PrivilegeChange" -> "privilege-change"
    var sb = new StringBuilder();
    for (int i = 0; i < simpleName.Length; i++) {
      var c = simpleName[i];
      if (i > 0 && char.IsUpper(c)) sb.Append('-');
      sb.Append(char.ToLowerInvariant(c));
    }

    // All Stage 1B events are security-bounded.
    return $"security.{sb}";
  }
}
