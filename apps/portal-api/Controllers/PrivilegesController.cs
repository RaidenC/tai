using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Tai.Portal.Core.Application.Models;
using Tai.Portal.Core.Application.UseCases.Privileges;
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

    try {
      return await _mediator.Send(command);
    } catch (KeyNotFoundException) {
      return NotFound();
    } catch (DbUpdateConcurrencyException) {
      return Conflict("Concurrency conflict detected.");
    }
  }
}
