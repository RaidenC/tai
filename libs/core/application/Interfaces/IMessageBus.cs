using System.Threading;
using System.Threading.Tasks;

namespace Tai.Portal.Core.Application.Interfaces;

/// <summary>
/// Abstraction for publishing integration events to an external message broker.
/// </summary>
public interface IMessageBus {
  Task PublishAsync<T>(T message, CancellationToken cancellationToken = default) where T : class;
}
