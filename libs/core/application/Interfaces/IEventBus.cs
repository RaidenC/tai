using System.Threading;
using System.Threading.Tasks;
using Tai.Portal.Core.Domain.Events;

namespace Tai.Portal.Core.Application.Interfaces;

/// <summary>
/// Internal event bus for publishing security-related events for real-time processing.
/// This abstraction allows the domain/identity layers to trigger security notifications
/// without being coupled to SignalR or external message brokers.
/// </summary>
public interface IEventBus {
  /// <summary>
  /// Publishes a security event to the internal bus.
  /// </summary>
  Task PublishAsync<T>(T securityEvent, CancellationToken cancellationToken = default) where T : SecurityEventBase;
}
