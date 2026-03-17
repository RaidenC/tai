using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Tai.Portal.Core.Application.Models;
using Tai.Portal.Core.Application.UseCases.Privileges;
using Tai.Portal.Core.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Tai.Portal.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PrivilegesController : ControllerBase {
  private readonly IMediator _mediator;

  public PrivilegesController(IMediator mediator) {
    _mediator = mediator;
  }

  [HttpGet]
  public async Task<ActionResult<PaginatedList<PrivilegeDto>>> GetPrivileges(
      [FromQuery] int pageNumber = 1,
      [FromQuery] int pageSize = 10,
      [FromQuery] string? search = null) {
    return await _mediator.Send(new GetPrivilegesQuery(pageNumber, pageSize, search));
  }

  [HttpPost]
  public async Task<ActionResult<PrivilegeDto>> CreatePrivilege(CreatePrivilegeCommand command) {
    // TODO: Add strict [Authorize(Roles = "SystemAdmin")] once security is fully wired up.

    var result = await _mediator.Send(command);
    return CreatedAtAction(nameof(GetPrivileges), new { id = result.Id }, result);
  }

  [HttpPut("{id}")]
  public async Task<ActionResult<PrivilegeDto>> UpdatePrivilege(Guid id, UpdatePrivilegeCommand command) {
    if (id != command.Id) {
      return BadRequest("ID mismatch");
    }

    // JUNIOR RATIONALE: For high-stakes actions, just being "Logged In" isn't enough. 
    // If you are changing a High or Critical privilege, we demand a "Step-Up." 
    // In our POC, this means the BFF (Backend-for-Frontend) must have verified 
    // a fresh MFA/Bio check. If not, we signal the UI to trigger that flow.
    var currentPrivilege = await _mediator.Send(new GetPrivilegeByIdQuery(id));
    if (currentPrivilege != null && (currentPrivilege.RiskLevel >= RiskLevel.High || command.RiskLevel >= RiskLevel.High)) {
      // JUNIOR RATIONALE: We check for a special "Step-Up" claim or header.
      // In this POC, we'll look for an 'X-Step-Up-Verified' header passed by the BFF.
      if (!Request.Headers.ContainsKey("X-Step-Up-Verified")) {
        Response.Headers.Append("X-Step-Up-Required", "true");
        return StatusCode(StatusCodes.Status403Forbidden, "Step-up authentication (MFA) is required for this action.");
      }
    }

    try {
      return await _mediator.Send(command);
    } catch (KeyNotFoundException) {
      return NotFound();
    } catch (DbUpdateConcurrencyException) {
      return Conflict("Concurrency conflict detected.");
    }
  }
}
