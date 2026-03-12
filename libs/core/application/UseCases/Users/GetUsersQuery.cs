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

public record PaginatedList<T>(List<T> Items, int TotalCount, int PageNumber, int PageSize);

public record GetUsersQuery(Guid TenantId, int PageNumber = 1, int PageSize = 10) : IRequest<PaginatedList<UserDto>>;

public class GetUsersQueryHandler : IRequestHandler<GetUsersQuery, PaginatedList<UserDto>> {
  private readonly IIdentityService _identityService;

  public GetUsersQueryHandler(IIdentityService identityService) {
    _identityService = identityService;
  }

  public async Task<PaginatedList<UserDto>> Handle(GetUsersQuery request, CancellationToken cancellationToken) {
    var skip = (request.PageNumber - 1) * request.PageSize;
    var tenantId = new TenantId(request.TenantId);

    var users = await _identityService.GetUsersByTenantAsync(
      tenantId,
      skip,
      request.PageSize,
      cancellationToken);

    var totalCount = await _identityService.CountUsersByTenantAsync(tenantId, cancellationToken);

    var items = users
      .Select(u => {
        var email = !string.IsNullOrWhiteSpace(u.Email) ? u.Email : (!string.IsNullOrWhiteSpace(u.UserName) ? u.UserName : "No Email");
        return new UserDto(u.Id, email, email, u.Status.ToString());
      })
      .ToList();

    return new PaginatedList<UserDto>(items, totalCount, request.PageNumber, request.PageSize);
  }
}
