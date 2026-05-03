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
  private readonly IRealTimeNotifier _realTimeNotifier;

  public PrivilegeModifiedEventHandler(
      PortalDbContext dbContext,
      IMessageBus messageBus,
      ICurrentUserService currentUserService,
      IRealTimeNotifier realTimeNotifier) {
    _dbContext = dbContext;
    _messageBus = messageBus;
    _currentUserService = currentUserService;
    _realTimeNotifier = realTimeNotifier;
  }

  public async Task Handle(DomainEventNotification<PrivilegeModifiedEvent> notification, CancellationToken cancellationToken) {
    var domainEvent = notification.DomainEvent;
    var userId = _currentUserService.UserId ?? "System";

    // Validate tenant is set before processing
    var tenantId = _dbContext.CurrentTenantId;
    if (tenantId == default) {
      throw new InvalidOperationException("TenantId must be set before processing PrivilegeModifiedEvent");
    }
    var tenantIdString = tenantId.Value.ToString();

    // 1. Record immutable audit entry
    var auditEntry = new AuditEntry(
        tenantId,
        userId,
        "PrivilegeModified",
        domainEvent.PrivilegeId.ToString(),
        _currentUserService.CorrelationId,
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

    // 3. Send tenant-scoped SignalR notification after commit
    _dbContext.RegisterPostCommitAction(ct =>
      _realTimeNotifier.SendSecurityEventAsync(
        tenantIdString,
        "PrivilegeChange",
        new {
          EventId = auditEntry.Id,
          Timestamp = auditEntry.Timestamp,
          Action = "privilege_modified"
        },
        ct));
  }
}
