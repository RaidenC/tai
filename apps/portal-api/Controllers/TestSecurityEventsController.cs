using Microsoft.AspNetCore.Mvc;
using MediatR;
using Tai.Portal.Core.Domain.Events;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Application.Models;

namespace Tai.Portal.Api.Controllers;

/// <summary>
/// Test controller to trigger security events for POC testing.
/// </summary>
[Route("api/test/security-events")]
[ApiController]
public class TestSecurityEventsController : ControllerBase {
  private readonly IMediator _mediator;

  public TestSecurityEventsController(IMediator mediator) {
    _mediator = mediator;
  }

  /// <summary>
  /// Trigger a LoginAnomaly event for testing - broadcasts to all connected clients
  /// </summary>
  [HttpPost("login-anomaly")]
  public async Task<IActionResult> TriggerLoginAnomaly([FromBody] LoginAnomalyRequest request) {
    var tenantId = new TenantId(Guid.NewGuid());
    var domainEvent = new LoginAnomalyEvent(
      tenantId,
      request.UserId ?? "test-user",
      request.Reason ?? "Test login anomaly",
      "Test details",
      request.IpAddress ?? "192.168.1.1"
    );

    await _mediator.Publish(new DomainEventNotification<LoginAnomalyEvent>(domainEvent));
    return Ok(new { message = "LoginAnomaly event triggered", eventType = "LoginAnomaly", tenantId = "broadcast" });
  }

  /// <summary>
  /// Trigger a PrivilegeChange event for testing - broadcasts to all
  /// </summary>
  [HttpPost("privilege-change")]
  public async Task<IActionResult> TriggerPrivilegeChange([FromBody] PrivilegeChangeRequest request) {
    var tenantId = new TenantId(Guid.NewGuid());
    var domainEvent = new PrivilegeChangeEvent(
      tenantId,
      request.UserId ?? "test-user",
      request.PrivilegeName ?? "TestPrivilege",
      request.ChangeType ?? "Added",
      request.PerformedBy ?? "admin"
    );

    await _mediator.Publish(new DomainEventNotification<PrivilegeChangeEvent>(domainEvent));
    return Ok(new { message = "PrivilegeChange event triggered", eventType = "PrivilegeChange", tenantId = "broadcast" });
  }
}

public class LoginAnomalyRequest {
  public string? UserId { get; set; }
  public string? TenantId { get; set; }
  public string? IpAddress { get; set; }
  public string? Reason { get; set; }
}

public class PrivilegeChangeRequest {
  public string? UserId { get; set; }
  public string? TenantId { get; set; }
  public string? PrivilegeName { get; set; }
  public string? ChangeType { get; set; }
  public string? PerformedBy { get; set; }
}