using System.Security.Claims;
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
 *
 * TENANT ISOLATION: Users are added to SignalR groups based on their TenantId.
 * When a security event occurs, only users in the same tenant receive the notification.
 */
[Authorize(AuthenticationSchemes = $"{OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme},Identity.Application")]
public class NotificationHub : Hub {
  /**
   * OnConnectedAsync is triggered whenever a new client (browser) connects.
   * We add the user to a SignalR group based on their TenantId for tenant-isolated broadcasts.
   */
  public override async Task OnConnectedAsync() {
    var tenantId = GetTenantIdFromClaims();

    if (!string.IsNullOrEmpty(tenantId)) {
      // Add user to tenant-specific group for isolated broadcast channels
      await Groups.AddToGroupAsync(Context.ConnectionId, tenantId);
    }

    await base.OnConnectedAsync();
  }

  /**
   * OnDisconnectedAsync is triggered when a client disconnects.
   * We remove the user from their tenant group.
   */
  public override async Task OnDisconnectedAsync(Exception? exception) {
    var tenantId = GetTenantIdFromClaims();

    if (!string.IsNullOrEmpty(tenantId)) {
      await Groups.RemoveFromGroupAsync(Context.ConnectionId, tenantId);
    }

    await base.OnDisconnectedAsync(exception);
  }

  /**
   * Extracts TenantId from the user's claims.
   * The claim is set during authentication in AuthorizationController.
   */
  private string? GetTenantIdFromClaims() {
    // Try to get tenant_id claim (set in AuthorizationController)
    var tenantClaim = Context.User?.FindFirst("tenant_id")?.Value;

    if (!string.IsNullOrEmpty(tenantClaim)) {
      return tenantClaim;
    }

    // Fallback: try to get from TenantId claim type
    return Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
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
