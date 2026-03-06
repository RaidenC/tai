using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Validation.AspNetCore;
using Tai.Portal.Core.Application.UseCases.Onboarding;

namespace Tai.Portal.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
public class OnboardingController : ControllerBase {
  private readonly IMediator _mediator;

  public OnboardingController(IMediator mediator) {
    _mediator = mediator;
  }

  [HttpPost("register")]
  [AllowAnonymous]
  public async Task<IActionResult> Register([FromBody] RegisterCustomerCommand command) {
    var userId = await _mediator.Send(command);
    return Ok(userId);
  }

  [HttpGet("pending-approvals")]
  [Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
  public async Task<IActionResult> GetPendingApprovals([FromQuery] Guid tenantId, [FromQuery] int page = 1, [FromQuery] int pageSize = 10) {
    var query = new GetPendingApprovalsQuery(tenantId, page, pageSize);
    var result = await _mediator.Send(query);
    return Ok(result);
  }

  public record ApproveRequest(string TargetUserId);

  [HttpPost("approve")]
  [Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
  public async Task<IActionResult> Approve([FromBody] ApproveRequest request) {
    var approverId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    if (string.IsNullOrEmpty(approverId)) {
      return Unauthorized();
    }

    var command = new ApproveStaffCommand(request.TargetUserId, approverId);
    await _mediator.Send(command);
    return Ok();
  }
}
