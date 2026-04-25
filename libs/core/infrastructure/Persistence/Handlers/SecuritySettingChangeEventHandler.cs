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
/// Handles SecuritySettingChangeEvent by recording an audit log, pushing real-time notification to SignalR,
/// and publishing to IMessageBus for cross-app communication.
/// </summary>
public class SecuritySettingChangeEventHandler : INotificationHandler<DomainEventNotification<SecuritySettingChangeEvent>> {
  private readonly PortalDbContext _dbContext;
  private readonly IMessageBus _messageBus;
  private readonly ICurrentUserService _currentUserService;
  private readonly IRealTimeNotifier _realTimeNotifier;

  public SecuritySettingChangeEventHandler(
      PortalDbContext dbContext,
      IMessageBus messageBus,
      ICurrentUserService currentUserService,
      IRealTimeNotifier realTimeNotifier) {
    _dbContext = dbContext;
    _messageBus = messageBus;
    _currentUserService = currentUserService;
    _realTimeNotifier = realTimeNotifier;
  }

  public async Task Handle(DomainEventNotification<SecuritySettingChangeEvent> notification, CancellationToken cancellationToken) {
    var domainEvent = notification.DomainEvent;

    // 1. Stage immutable audit entry — UoW commits.
    var auditEntry = new AuditEntry(
        domainEvent.TenantId,
        domainEvent.UserId,
        "SecuritySettingChange",
        domainEvent.ResourceId,
        domainEvent.CorrelationId,
        domainEvent.IpAddress,
        $"Security setting changed: {domainEvent.SettingName}. {domainEvent.Details}"
    );
    _dbContext.AuditLogs.Add(auditEntry);

    // 2. Stage outbox row for cross-app delivery.
    await _messageBus.PublishAsync(new {
      EventName = "SecuritySettingChange",
      EventId = auditEntry.Id,
      TenantId = domainEvent.TenantId.Value,
      UserId = domainEvent.UserId,
      SettingName = domainEvent.SettingName,
      Details = domainEvent.Details,
      ResourceId = domainEvent.ResourceId,
      Timestamp = auditEntry.Timestamp,
      CorrelationId = domainEvent.CorrelationId
    }, cancellationToken);

    // 3. Defer SignalR push to AFTER commit.
    _dbContext.RegisterPostCommitAction(ct =>
      _realTimeNotifier.SendSecurityEventAsync(
        domainEvent.TenantId.Value.ToString(),
        "SecuritySettingChange",
        new {
          EventId = auditEntry.Id,
          Timestamp = auditEntry.Timestamp,
          SettingName = domainEvent.SettingName,
          ResourceId = domainEvent.ResourceId
        },
        ct));
  }
}
