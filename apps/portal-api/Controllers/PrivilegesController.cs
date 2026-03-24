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
[Authorize]
public class PrivilegesController : ControllerBase {
  private readonly IMediator _mediator;

  public PrivilegesController(IMediator mediator) {
    _mediator = mediator;
  }

  [HttpGet]
  public async Task<ActionResult<PaginatedList<PrivilegeDto>>> GetPrivileges(
      [FromQuery] int pageNumber = 1,
      [FromQuery] int pageSize = 10,
      [FromQuery] string? search = null,
      [FromQuery] string[]? modules = null) {
    var query = new GetPrivilegesQuery(pageNumber, pageSize, search, modules);
    return await _mediator.Send(query);
  }

  [HttpGet("{id}")]
  public async Task<ActionResult<PrivilegeDto>> GetPrivilege(Guid id) {
    var query = new GetPrivilegeByIdQuery(id);
    var result = await _mediator.Send(query);
    if (result == null) return NotFound();
    return result;
  }

  [HttpPost]
  [Authorize(Roles = "Admin")]
  public async Task<ActionResult<PrivilegeDto>> CreatePrivilege(CreatePrivilegeCommand command) {
    var result = await _mediator.Send(command);
    return CreatedAtAction(nameof(GetPrivileges), new { id = result.Id }, result);
  }

  [HttpPut("{id}")]
  [Authorize(Roles = "Admin")]
  public async Task<ActionResult<PrivilegeDto>> UpdatePrivilege(Guid id, UpdatePrivilegeCommand command) {
    if (id != command.Id) {
      return BadRequest("ID mismatch");
    }

    // JUNIOR RATIONALE: For high-stakes actions, just being "Logged In" isn't enough. 
    // We check for a special header that indicates the user has recently passed MFA.
    if (command.RiskLevel >= RiskLevel.High) {
      var stepUpVerified = Request.Headers["X-Step-Up-Verified"] == "true";
      if (!stepUpVerified) {
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
