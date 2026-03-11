using MediatR;
using Tai.Portal.Core.Domain.Interfaces;

namespace Tai.Portal.Core.Application.Models;

public class DomainEventNotification<T> : INotification where T : IDomainEvent {
  public T DomainEvent { get; }

  public DomainEventNotification(T domainEvent) {
    DomainEvent = domainEvent;
  }
}
