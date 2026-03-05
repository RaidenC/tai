using Tai.Portal.Core.Domain.Interfaces;

namespace Tai.Portal.Core.Domain.Events;

public record UserApprovedEvent(string UserId, string ApprovedByUserId) : IDomainEvent;
