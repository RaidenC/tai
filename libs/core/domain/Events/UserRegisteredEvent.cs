using Tai.Portal.Core.Domain.Interfaces;

namespace Tai.Portal.Core.Domain.Events;

public record UserRegisteredEvent(string UserId) : IDomainEvent;
