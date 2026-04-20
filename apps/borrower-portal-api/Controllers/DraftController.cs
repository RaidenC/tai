using System;
using System.Threading.Tasks;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Tai.PaymentProtection.Application.UseCases.Drafts;
using Tai.Portal.Core.Application.Interfaces;

namespace Tai.BorrowerPortal.Api.Controllers;

[ApiController]
[Route("api/claims")]
public class DraftController : ControllerBase {
  private readonly IMediator _mediator;
  private readonly ICurrentUserService _currentUser;
  private const int DefaultTtlHours = 24;

  public DraftController(IMediator mediator, ICurrentUserService currentUser) {
    _mediator = mediator;
    _currentUser = currentUser;
  }

  public record SaveDraftRequest(string ClaimId, byte[] EncryptedPayload, int? TtlHours);

  [HttpPatch("draft")]
  public async Task<IActionResult> Save([FromBody] SaveDraftRequest request) {
    var userId = _currentUser.UserId!;
    var ttl = TimeSpan.FromHours(request.TtlHours ?? DefaultTtlHours);
    await _mediator.Send(new SaveClaimDraftCommand(userId, request.ClaimId, request.EncryptedPayload, ttl));
    return NoContent();
  }

  [HttpGet("draft/{claimId}")]
  public async Task<IActionResult> Get(string claimId) {
    var userId = _currentUser.UserId!;
    var result = await _mediator.Send(new GetClaimDraftQuery(userId, claimId));
    return result == null ? NotFound() : Ok(result);
  }

  [HttpDelete("draft/{claimId}")]
  public async Task<IActionResult> Delete(string claimId) {
    var userId = _currentUser.UserId!;
    await _mediator.Send(new DeleteClaimDraftCommand(userId, claimId));
    return NoContent();
  }
}
