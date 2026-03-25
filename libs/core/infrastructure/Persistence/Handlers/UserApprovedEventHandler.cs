using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Tai.Portal.Core.Domain.Events;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Infrastructure.Persistence;
using Tai.Portal.Core.Application.Models;
using Tai.Portal.Core.Application.Interfaces;

namespace Tai.Portal.Core.Infrastructure.Persistence.Handlers;

/// <summary>
/// Infrastructure-level event handler that listens for UserApprovedEvent 
/// (wrapped in DomainEventNotification) and records an immutable audit entry in the system logs.
/// </summary>
public class UserApprovedEventHandler : INotificationHandler<DomainEventNotification<UserApprovedEvent>> {
  private readonly PortalDbContext _dbContext;
  private readonly ICurrentUserService _currentUserService;

  public UserApprovedEventHandler(PortalDbContext dbContext, ICurrentUserService currentUserService) {
    _dbContext = dbContext;
    _currentUserService = currentUserService;
  }

  public async Task Handle(DomainEventNotification<UserApprovedEvent> notification, CancellationToken cancellationToken) {
    var domainEvent = notification.DomainEvent;

    // Note: Since this is an audit log, it's immutable and critical for SOC 2 compliance.
    // We record who (Admin), what (Approved), and when (implicitly in the AuditEntry constructor).

    // We need the TenantId of the user being approved to ensure the audit log is multi-tenant aware.
    var user = await _dbContext.Users.FindAsync(new object[] { domainEvent.UserId }, cancellationToken);

    if (user == null) return;

    var auditEntry = new AuditEntry(
        user.TenantId,
        (string)domainEvent.ApprovedByUserId,
        "UserApproved",
        domainEvent.UserId,
        _currentUserService.CorrelationId,
        null, // IP Address would ideally be captured from HttpContext if available.
        $"User {user.UserName} approved by administrator {domainEvent.ApprovedByUserId}."
    );

    _dbContext.AuditLogs.Add(auditEntry);
  }
}

