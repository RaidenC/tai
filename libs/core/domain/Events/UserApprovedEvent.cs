using Tai.Portal.Core.Domain.Interfaces;
using Tai.Portal.Core.Domain.ValueObjects;

namespace Tai.Portal.Core.Domain.Events;

public record UserApprovedEvent(string UserId, TenantAdminId ApprovedByUserId) : IDomainEvent;
