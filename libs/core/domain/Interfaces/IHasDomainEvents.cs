using System.Collections.Generic;

namespace Tai.Portal.Core.Domain.Interfaces;

public interface IHasDomainEvents {
  IReadOnlyCollection<IDomainEvent> DomainEvents { get; }
  void ClearDomainEvents();
}
