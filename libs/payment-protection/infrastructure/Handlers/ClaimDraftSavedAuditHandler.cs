using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.Extensions.Logging;
using Tai.PaymentProtection.Application.Events;
using Tai.Portal.Core.Application.Interfaces;

namespace Tai.PaymentProtection.Infrastructure.Handlers;

/// <summary>
/// Reacts to ClaimDraftSavedEvent. Currently logs an audit line and publishes
/// to IMessageBus (LoggingMessageBus today). Future: a sibling handler could
/// write to an outbox table for RabbitMQ delivery.
/// </summary>
public class ClaimDraftSavedAuditHandler : INotificationHandler<ClaimDraftSavedEvent> {
  private readonly IMessageBus _bus;
  private readonly ILogger<ClaimDraftSavedAuditHandler> _logger;

  public ClaimDraftSavedAuditHandler(IMessageBus bus, ILogger<ClaimDraftSavedAuditHandler> logger) {
    _bus = bus;
    _logger = logger;
  }

  public async Task Handle(ClaimDraftSavedEvent notification, CancellationToken cancellationToken) {
    _logger.LogInformation("ClaimDraft saved: user={UserId} claim={ClaimId} at={SavedAt}",
      notification.UserId, notification.ClaimId, notification.SavedAt);

    try {
      await _bus.PublishAsync(notification, cancellationToken);
    } catch (Exception ex) {
      _logger.LogError(ex, "Failed to publish ClaimDraftSavedEvent for claim {ClaimId}", notification.ClaimId);
    }
  }
}
