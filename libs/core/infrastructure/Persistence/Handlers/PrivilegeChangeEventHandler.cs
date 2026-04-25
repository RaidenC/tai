using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Application.Models;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.Events;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Infrastructure.Persistence;

namespace Tai.Portal.Core.Infrastructure.Persistence.Handlers;

/// <summary>
/// Handles PrivilegeChangeEvent by recording an audit log, pushing real-time notification to SignalR,
/// and publishing to IMessageBus for cross-app communication.
/// </summary>
public class PrivilegeChangeEventHandler : INotificationHandler<DomainEventNotification<PrivilegeChangeEvent>> {
  private readonly PortalDbContext _dbContext;
  private readonly IMessageBus _messageBus;
  private readonly ICurrentUserService _currentUserService;
  private readonly IRealTimeNotifier _realTimeNotifier;

  public PrivilegeChangeEventHandler(
      PortalDbContext dbContext,
      IMessageBus messageBus,
      ICurrentUserService currentUserService,
      IRealTimeNotifier realTimeNotifier) {
    _dbContext = dbContext;
    _messageBus = messageBus;
    _currentUserService = currentUserService;
    _realTimeNotifier = realTimeNotifier;
  }

  public async Task Handle(DomainEventNotification<PrivilegeChangeEvent> notification, CancellationToken cancellationToken) {
    var domainEvent = notification.DomainEvent;

    // 1. Stage immutable audit entry. NOTE: no SaveChangesAsync — the
    //    PortalDbContext UoW orchestrator commits everything together.
    var auditEntry = new AuditEntry(
        domainEvent.TenantId,
        domainEvent.UserId,
        "PrivilegeChange",
        domainEvent.ResourceId,
        domainEvent.CorrelationId,
        domainEvent.IpAddress,
        $"Privilege change: {domainEvent.Action}. {domainEvent.Details}"
    );
    _dbContext.AuditLogs.Add(auditEntry);

    // 2. Stage outbox row for cross-app delivery (DocViewer, HR System).
    //    OutboxMessageBus.PublishAsync only Add()s — caller commits.
    await _messageBus.PublishAsync(new {
      EventName = "PrivilegeChange",
      EventId = auditEntry.Id,
      TenantId = domainEvent.TenantId.Value,
      UserId = domainEvent.UserId,
      Action = domainEvent.Action,
      Details = domainEvent.Details,
      ResourceId = domainEvent.ResourceId,
      Timestamp = auditEntry.Timestamp,
      CorrelationId = domainEvent.CorrelationId
    }, cancellationToken);

    // 3. Defer SignalR push to AFTER the transaction commits.
    //    Pre-refactor, this fired before commit and could ghost-notify
    //    users about state changes that ultimately rolled back.
    _dbContext.RegisterPostCommitAction(ct =>
      _realTimeNotifier.SendSecurityEventAsync(
        domainEvent.TenantId.Value.ToString(),
        "PrivilegeChange",
        new {
          EventId = auditEntry.Id,
          Timestamp = auditEntry.Timestamp,
          Action = domainEvent.Action,
          ResourceId = domainEvent.ResourceId
        },
        ct));
  }
}
