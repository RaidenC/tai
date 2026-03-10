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
  public async Task<IActionResult> GetUsers([FromQuery] int page = 1, [FromQuery] int pageSize = 10) {
    var query = new GetUsersQuery(_tenantService.TenantId.Value, page, pageSize);
    var result = await _mediator.Send(query);
    return Ok(result);
  }
}
