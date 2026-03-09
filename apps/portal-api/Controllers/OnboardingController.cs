using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Validation.AspNetCore;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Application.UseCases.Onboarding;

namespace Tai.Portal.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize(AuthenticationSchemes = $"{OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme},Identity.Application")]
public class OnboardingController : ControllerBase {
  private readonly IMediator _mediator;
  private readonly ITenantService _tenantService;

  public OnboardingController(IMediator mediator, ITenantService tenantService) {
    _mediator = mediator;
    _tenantService = tenantService;
  }

  public record VerifyRequest(string UserId, string Code);

  [HttpPost("verify")]
  [AllowAnonymous]
  public async Task<IActionResult> Verify([FromBody] VerifyRequest request) {
    try {
      var command = new ActivateUserCommand(request.UserId, request.Code);
      await _mediator.Send(command);
      return Ok();
    } catch (System.Exception ex) {
      return BadRequest(new { error = ex.Message });
    }
  }

  [HttpPost("register")]
  [AllowAnonymous]
  public async Task<IActionResult> Register([FromBody] RegisterCustomerCommand command) {
    var resolvedCommand = command with { TenantId = _tenantService.TenantId.Value };
    var userId = await _mediator.Send(resolvedCommand);
    return Ok(new { userId });
  }

  [HttpGet("pending-approvals")]
  public async Task<IActionResult> GetPendingApprovals([FromQuery] int page = 1, [FromQuery] int pageSize = 10) {
    var query = new GetPendingApprovalsQuery(_tenantService.TenantId.Value, page, pageSize);
    var result = await _mediator.Send(query);
    return Ok(result);
  }

  public record ApproveRequest(string TargetUserId);

  [HttpPost("approve")]
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
