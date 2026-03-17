using Microsoft.AspNetCore.SignalR;
using Tai.Portal.Api.Hubs;
using Tai.Portal.Core.Application.Interfaces;

namespace Tai.Portal.Api.Services;

/**
 * PrivilegeNotificationService
 * 
 * JUNIOR RATIONALE: This service bridges the Application layer and the 
 * Presentation layer (SignalR). By implementing the interface from 
 * Application, we can call it from our business logic without 
 * the business logic needing to know about Hubs or Web Sockets.
 */
public class PrivilegeNotificationService : IPrivilegeNotificationService {
  private readonly IHubContext<PrivilegeHub> _hubContext;

  public PrivilegeNotificationService(IHubContext<PrivilegeHub> hubContext) {
    _hubContext = hubContext;
  }

  public async Task NotifyPrivilegeChangedAsync(Guid id, string name, CancellationToken cancellationToken) {
    // Broadcast to all connected clients. 
    // In a real app, we might target specific users or groups.
    await _hubContext.Clients.All.SendAsync("PrivilegeChanged", new { Id = id, Name = name }, cancellationToken);
  }
}
