using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Domain.Enums;
using Tai.Portal.Core.Domain.ValueObjects;

namespace Tai.Portal.Core.Application.UseCases.Users;

public record UserDto(string Id, string Email, string Name, string Status);

public record GetUsersQuery(Guid TenantId, int Page = 1, int PageSize = 10) : IRequest<List<UserDto>>;

public class GetUsersQueryHandler : IRequestHandler<GetUsersQuery, List<UserDto>> {
  private readonly IIdentityService _identityService;

  public GetUsersQueryHandler(IIdentityService identityService) {
    _identityService = identityService;
  }

  public async Task<List<UserDto>> Handle(GetUsersQuery request, CancellationToken cancellationToken) {
    var skip = (request.Page - 1) * request.PageSize;

    var users = await _identityService.GetUsersByTenantAsync(
      new TenantId(request.TenantId),
      skip,
      request.PageSize,
      cancellationToken);

    return users
      .Select(u => {
        var email = !string.IsNullOrWhiteSpace(u.Email) ? u.Email : (!string.IsNullOrWhiteSpace(u.UserName) ? u.UserName : "No Email");
        return new UserDto(u.Id, email, email, u.Status.ToString());
      })
      .ToList();
  }
}
