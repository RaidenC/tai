using System;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;

namespace Tai.Portal.Core.Infrastructure.Messaging;

/// <summary>
/// Singleton holder for a single IConnection. Created lazily on first access
/// so app startup doesn't fail if the broker isn't up yet.
/// </summary>
public class RabbitMqConnectionProvider : IRabbitMqConnectionProvider, IDisposable {
  private readonly object _lock = new();
  private readonly RabbitMqOptions _options;
  private IConnection? _connection;
  private bool _disposed;

  public RabbitMqConnectionProvider(IOptions<RabbitMqOptions> options) {
    _options = options.Value;
  }

  public IConnection Connection {
    get {
      if (_disposed) throw new ObjectDisposedException(nameof(RabbitMqConnectionProvider));
      if (_connection is { IsOpen: true }) return _connection;
      lock (_lock) {
        if (_connection is { IsOpen: true }) return _connection;
        _connection?.Dispose();
        _connection = CreateConnection();
        return _connection;
      }
    }
  }

  private IConnection CreateConnection() {
    var factory = new ConnectionFactory {
      HostName = _options.HostName,
      Port = _options.Port,
      UserName = _options.UserName,
      Password = _options.Password,
      VirtualHost = _options.VirtualHost,
      // JUNIOR RATIONALE (Automatic recovery):
      // Networks blip, brokers restart, k8s reschedules. AutomaticRecovery
      // tells the client to reconnect transparently. TopologyRecovery
      // re-declares exchanges/queues after reconnect — without it, the
      // connection comes back but publishes target exchanges that no
      // longer exist on the broker.
      AutomaticRecoveryEnabled = true,
      TopologyRecoveryEnabled = true,
      NetworkRecoveryInterval = TimeSpan.FromSeconds(5),
    };
    return factory.CreateConnection("portal-api");
  }

  public void Dispose() {
    if (_disposed) return;
    _disposed = true;
    _connection?.Close();
    _connection?.Dispose();
  }
}
