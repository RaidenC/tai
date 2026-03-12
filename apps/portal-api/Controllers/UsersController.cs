using System;
using System.Threading.Tasks;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Validation.AspNetCore;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Application.UseCases.Users;
using Tai.Portal.Core.Domain.ValueObjects;

namespace Tai.Portal.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize(AuthenticationSchemes = $"{OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme},Identity.Application,TestAuth")]
public class UsersController : ControllerBase {
  private readonly IMediator _mediator;
  private readonly ITenantService _tenantService;

  public UsersController(IMediator mediator, ITenantService tenantService) {
    _mediator = mediator;
    _tenantService = tenantService;
  }

  [HttpGet]
  public async Task<IActionResult> GetUsers([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 10) {
    var query = new GetUsersQuery(_tenantService.TenantId.Value, pageNumber, pageSize);
    var result = await _mediator.Send(query);
    return Ok(result);
  }

  [HttpGet("{id}")]
  public async Task<IActionResult> GetUser(string id) {
    var query = new GetUserByIdQuery(id);
    var result = await _mediator.Send(query);

    if (result == null) {
      return NotFound();
    }

    // Set ETag header for optimistic concurrency
    Response.Headers.ETag = $"\"{result.RowVersion}\"";

    return Ok(result);
  }

  public record UpdateUserRequest(string Email, string FirstName, string LastName);

  [HttpPut("{id}")]
  public async Task<IActionResult> UpdateUser(string id, [FromBody] UpdateUserRequest request) {
    uint? expectedRowVersion = null;
    var ifMatch = Request.Headers.IfMatch.ToString();
    if (!string.IsNullOrEmpty(ifMatch)) {
      if (uint.TryParse(ifMatch.Trim('"'), out var version)) {
        expectedRowVersion = version;
      } else {
        return BadRequest(new { error = "Invalid If-Match header format. Expected numeric row version." });
      }
    }

    var command = new UpdateUserCommand(id, request.Email, request.FirstName, request.LastName, expectedRowVersion);
    await _mediator.Send(command);
    return NoContent();
  }
}
