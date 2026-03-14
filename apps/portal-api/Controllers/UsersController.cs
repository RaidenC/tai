using System;
using System.Threading.Tasks;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Validation.AspNetCore;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Application.UseCases.Users;

namespace Tai.Portal.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize(AuthenticationSchemes = $"{OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme},Identity.Application")]
public class UsersController : ControllerBase {
  private readonly IMediator _mediator;
  private readonly ITenantService _tenantService;

  public UsersController(IMediator mediator, ITenantService tenantService) {
    _mediator = mediator;
    _tenantService = tenantService;
  }

  [HttpGet]
  public async Task<IActionResult> GetUsers(
      [FromQuery] int pageNumber = 1,
      [FromQuery] int pageSize = 10,
      [FromQuery] string? sort = null,
      [FromQuery] string? dir = null,
      [FromQuery] string? search = null) {
    var query = new GetUsersQuery(_tenantService.TenantId.Value, pageNumber, pageSize, sort, dir, search);
    var result = await _mediator.Send(query);
    return Ok(result);
  }

  [HttpGet("{id}")]
  public async Task<IActionResult> GetUserById(string id) {
    var query = new GetUserByIdQuery(id);
    var result = await _mediator.Send(query);

    if (result == null) {
      return NotFound();
    }

    Response.Headers.ETag = $"\"{result.RowVersion}\"";
    return Ok(result);
  }

  public record UpdateUserRequest(string FirstName, string LastName, string Email);

  [HttpPut("{id}")]
  public async Task<IActionResult> UpdateUser(string id, [FromBody] UpdateUserRequest request) {
    if (!Request.Headers.TryGetValue("If-Match", out var ifMatch) || !uint.TryParse(ifMatch.ToString().Trim('"'), out var rowVersion)) {
      return BadRequest("If-Match header is required and must contain a valid ETag.");
    }

    var command = new UpdateUserCommand(id, request.FirstName, request.LastName, request.Email, rowVersion);
    try {
      var result = await _mediator.Send(command);
      if (!result) {
        return NotFound();
      }
      return NoContent();
    } catch (Exception ex) when (ex.Message.Contains("Concurrency conflict")) {
      return Conflict(new { message = ex.Message });
    }
  }

  [HttpPost("{id}/approve")]
  public async Task<IActionResult> ApproveUser(string id) {
    if (!Request.Headers.TryGetValue("If-Match", out var ifMatch) || !uint.TryParse(ifMatch.ToString().Trim('"'), out var rowVersion)) {
      return BadRequest("If-Match header is required and must contain a valid ETag.");
    }

    // AdminId should come from User context, but for now we'll mock it or use a default
    var adminId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "00000000-0000-0000-0000-000000000010";

    var command = new ApproveUserCommand(id, adminId, rowVersion);
    try {
      var result = await _mediator.Send(command);
      if (!result) {
        return NotFound();
      }
      return NoContent();
    } catch (Exception ex) when (ex.Message.Contains("Concurrency conflict")) {
      return Conflict(new { message = ex.Message });
    }
  }
}
