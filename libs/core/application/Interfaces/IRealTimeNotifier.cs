using System.Threading;
using System.Threading.Tasks;

namespace Tai.Portal.Core.Application.Interfaces;

/// <summary>
/// Abstraction for pushing real-time notifications to connected clients via SignalR.
/// Implemented in the API layer to avoid circular dependencies between infrastructure and API projects.
/// </summary>
public interface IRealTimeNotifier {
  /// <summary>
  /// Pushes a security event to all clients in a specific tenant group.
  /// </summary>
  Task SendSecurityEventAsync<T>(string tenantId, string eventType, T payload, CancellationToken cancellationToken = default);
}
