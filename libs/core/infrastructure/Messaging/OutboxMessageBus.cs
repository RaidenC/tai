using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Infrastructure.Persistence;
using Tai.Portal.Core.Infrastructure.Persistence.Entities;

namespace Tai.Portal.Core.Infrastructure.Messaging;

/// <summary>
/// IMessageBus implementation that writes integration events to the OutboxMessages table
/// inside the caller's transaction, for reliable cross-app delivery via the publisher worker.
/// </summary>
public class OutboxMessageBus : IMessageBus {
  private static readonly JsonSerializerOptions _serializerOptions = new() {
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
  };

  private readonly PortalDbContext _dbContext;
  private readonly ICurrentUserService _currentUserService;

  public OutboxMessageBus(PortalDbContext dbContext, ICurrentUserService currentUserService) {
    _dbContext = dbContext;
    _currentUserService = currentUserService;
  }

  public Task PublishAsync<T>(T message, CancellationToken cancellationToken = default) where T : class {
    // JUNIOR RATIONALE (Transactional outbox — the key insight):
    // We do NOT call SaveChangesAsync here. We only Add the outbox row to
    // the ChangeTracker. The caller's surrounding SaveChangesAsync is what
    // commits it — atomically with the caller's other writes (audit entry,
    // domain entity mutation, etc.). This is the entire transactional
    // guarantee of the pattern: all DB work and the "message to be sent"
    // commit together or not at all.

    // JUNIOR RATIONALE (Concrete runtime type for serialization):
    // message.GetType() returns the concrete runtime type. Passing typeof(T)
    // when T is `object` or an interface drops all properties declared on
    // the concrete subtype — classic System.Text.Json gotcha.
    var runtimeType = message.GetType();

    _dbContext.OutboxMessages.Add(new OutboxMessage {
      Id = Guid.NewGuid(),
      EventType = runtimeType.AssemblyQualifiedName ?? runtimeType.FullName ?? runtimeType.Name,
      Payload = JsonSerializer.Serialize(message, runtimeType, _serializerOptions),
      OccurredAt = DateTimeOffset.UtcNow,
      CorrelationId = _currentUserService.CorrelationId,
    });

    return Task.CompletedTask;
  }
}
