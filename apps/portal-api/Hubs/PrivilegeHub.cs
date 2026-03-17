using Microsoft.AspNetCore.SignalR;

namespace Tai.Portal.Api.Hubs;

/**
 * PrivilegeHub
 * 
 * JUNIOR RATIONALE: We use SignalR to notify clients when privileges change.
 * This allows for "Immediate UI Degradation" where a user's access can be 
 * revoked or modified without them needing to refresh the page.
 */
public class PrivilegeHub : Hub {
  // Currently just a marker hub for broadcasting.
  // In a full implementation, we might handle group joining by TenantId.
}
