using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Validation.AspNetCore;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Application.UseCases.Onboarding;
using Tai.Portal.Core.Domain.ValueObjects;

namespace Tai.Portal.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize(AuthenticationSchemes = $"{OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme},Identity.Application,TestAuth")]
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
    var command = new ActivateUserCommand(request.UserId, request.Code);
    await _mediator.Send(command);
    return Ok();
  }

  public record RegistrationRequest(string Email, string Password, string FirstName, string LastName);

  [HttpPost("register")]
  [AllowAnonymous]
  public async Task<IActionResult> Register([FromBody] RegistrationRequest request) {
    var tenantId = _tenantService.TenantId.Value;

    // Simple heuristic: if the email matches the tenant domain, it's staff
    // In a real app, this might be a toggle in the UI or a more complex rule.
    bool isStaff = request.Email.EndsWith("@tai.com") || request.Email.EndsWith("@acme.com");

    if (isStaff) {
      var command = new RegisterStaffCommand(tenantId, request.Email, request.Password, request.FirstName, request.LastName);
      var userId = await _mediator.Send(command);
      return Ok(new { UserId = userId });
    } else {
      var command = new RegisterCustomerCommand(tenantId, request.Email, request.Password, request.FirstName, request.LastName);
      var userId = await _mediator.Send(command);
      return Ok(new { UserId = userId });
    }
  }

  [HttpGet("pending-approvals")]
  public async Task<IActionResult> GetPendingApprovals([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 10) {
    var query = new GetPendingApprovalsQuery(_tenantService.TenantId.Value, pageNumber, pageSize);
    var result = await _mediator.Send(query);
    return Ok(result);
  }

  [HttpGet("diag-pending-approvals")]
  [AllowAnonymous]
  public async Task<IActionResult> DiagGetPendingApprovals([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 10) {
    var query = new GetPendingApprovalsQuery(_tenantService.TenantId.Value, pageNumber, pageSize);
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

    // JUNIOR RATIONALE: We extract the 'If-Match' header to get the expected 
    // RowVersion. If the header is provided but invalid, we return 400 
    // to warn the caller that their concurrency check won't work.
    uint? expectedRowVersion = null;
    var ifMatch = Request.Headers.IfMatch.ToString();
    if (!string.IsNullOrEmpty(ifMatch)) {
      if (uint.TryParse(ifMatch.Trim('"'), out var version)) {
        expectedRowVersion = version;
      } else {
        return BadRequest(new { error = "Invalid If-Match header format. Expected numeric row version." });
      }
    }

    var command = new ApproveStaffCommand(request.TargetUserId, approverId, expectedRowVersion);
    await _mediator.Send(command);
    return Ok();
  }
}
