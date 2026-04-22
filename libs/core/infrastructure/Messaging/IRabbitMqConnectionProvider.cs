using RabbitMQ.Client;

namespace Tai.Portal.Core.Infrastructure.Messaging;

/// <summary>
/// Holds a singleton AMQP connection for the application instance.
/// </summary>
/// <remarks>
/// JUNIOR RATIONALE (Connection lifecycle):
/// AMQP connections are HEAVY (TLS handshake, AMQP handshake, heartbeats).
/// You open ONE per application instance and reuse it. Channels (IModel) are
/// the cheap thing — open one per logical operation or per worker thread.
/// </remarks>
public interface IRabbitMqConnectionProvider {
  IConnection Connection { get; }
}
