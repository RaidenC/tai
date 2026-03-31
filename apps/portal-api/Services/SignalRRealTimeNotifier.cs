using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using Tai.Portal.Api.Hubs;
using Tai.Portal.Core.Application.Interfaces;

namespace Tai.Portal.Api.Services;

/// <summary>
/// SignalR-based implementation of IRealTimeNotifier.
/// Pushes real-time security events to connected clients via SignalR.
/// </summary>
public class SignalRRealTimeNotifier : IRealTimeNotifier {
  private readonly IHubContext<NotificationHub> _hubContext;

  public SignalRRealTimeNotifier(IHubContext<NotificationHub> hubContext) {
    _hubContext = hubContext;
  }

  public async Task SendSecurityEventAsync<T>(string tenantId, string eventType, T payload, CancellationToken cancellationToken = default) {
    // Push to the tenant-specific group so only users in that tenant receive the event
    await _hubContext.Clients.Group(tenantId)
        .SendAsync("SecurityEvent", new {
          EventType = eventType,
          Payload = payload
        }, cancellationToken);
  }
}
