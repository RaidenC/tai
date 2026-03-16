using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Tai.Portal.Core.Domain.Events;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Infrastructure.Persistence;
using Tai.Portal.Core.Application.Models;
using Tai.Portal.Core.Application.Interfaces;

namespace Tai.Portal.Core.Infrastructure.Persistence.Handlers;

/// <summary>
/// Handles PrivilegeModifiedEvent by recording an audit log and publishing to the message bus.
/// </summary>
public class PrivilegeModifiedEventHandler : INotificationHandler<DomainEventNotification<PrivilegeModifiedEvent>> {
  private readonly PortalDbContext _dbContext;
  private readonly IMessageBus _messageBus;
  private readonly ICurrentUserService _currentUserService;

  private static readonly TenantId SystemTenantId = new(Guid.Parse("00000000-0000-0000-0000-000000000001"));

  public PrivilegeModifiedEventHandler(
      PortalDbContext dbContext,
      IMessageBus messageBus,
      ICurrentUserService currentUserService) {
    _dbContext = dbContext;
    _messageBus = messageBus;
    _currentUserService = currentUserService;
  }

  public async Task Handle(DomainEventNotification<PrivilegeModifiedEvent> notification, CancellationToken cancellationToken) {
    var domainEvent = notification.DomainEvent;
    var userId = _currentUserService.UserId ?? "System";

    // 1. Record immutable audit entry
    var auditEntry = new AuditEntry(
        SystemTenantId,
        userId,
        "PrivilegeModified",
        domainEvent.PrivilegeId.ToString(),
        null,
        $"Privilege '{domainEvent.Name}' was modified by {userId}."
    );

    _dbContext.AuditLogs.Add(auditEntry);

    // 2. Publish integration event for external systems (e.g., Cache invalidation, SIEM)
    await _messageBus.PublishAsync(new {
      EventName = "PrivilegeModified",
      PrivilegeId = domainEvent.PrivilegeId.Value,
      PrivilegeName = domainEvent.Name,
      ModifiedBy = userId,
      Timestamp = System.DateTimeOffset.UtcNow
    }, cancellationToken);
  }
}
