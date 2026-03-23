using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using OpenIddict.Validation.AspNetCore;

namespace Tai.Portal.Api.Hubs;

/**
 * NotificationHub is the central real-time communication point for the Portal.
 * 
 * JUNIOR RATIONALE: We use [Authorize] to ensure that only authenticated users 
 * can establish a persistent WebSocket connection. By specifying both the 
 * OpenIddict (JWT) and Identity.Application (Cookie) schemes, we support 
 * both standard API clients and the browser-based BFF pattern.
 */
[Authorize(AuthenticationSchemes = $"{OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme},Identity.Application")]
public class NotificationHub : Hub {
  /**
   * OnConnectedAsync is triggered whenever a new client (browser) connects.
   */
  public override async Task OnConnectedAsync() {
    var userId = Context.UserIdentifier ?? "anonymous";
    // We log the connection for debugging and audit purposes.
    // In a real app, we might also add the user to specific SignalR Groups 
    // based on their TenantId or Roles here.
    await base.OnConnectedAsync();
  }

  /**
   * SendNotification allows a client to broadcast a message (though usually, 
   * in our architecture, notifications are pushed FROM the server TO the client).
   */
  public async Task SendNotification(string message) {
    // Broadcast the message to all connected clients.
    await Clients.All.SendAsync("ReceiveNotification", message);
  }
}
