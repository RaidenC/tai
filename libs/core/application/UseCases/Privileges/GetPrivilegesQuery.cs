using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Application.Models;

namespace Tai.Portal.Core.Application.UseCases.Privileges;

public record GetPrivilegesQuery(
    int PageNumber = 1,
    int PageSize = 10,
    string? Search = null) : IRequest<PaginatedList<PrivilegeDto>>;

public class GetPrivilegesQueryHandler : IRequestHandler<GetPrivilegesQuery, PaginatedList<PrivilegeDto>> {
  private readonly IPrivilegeService _privilegeService;

  public GetPrivilegesQueryHandler(IPrivilegeService privilegeService) {
    _privilegeService = privilegeService;
  }

  public async Task<PaginatedList<PrivilegeDto>> Handle(GetPrivilegesQuery request, CancellationToken cancellationToken) {
    var skip = (request.PageNumber - 1) * request.PageSize;

    var items = await _privilegeService.GetPrivilegesAsync(
      skip,
      request.PageSize,
      request.Search,
      cancellationToken);

    var totalCount = await _privilegeService.CountPrivilegesAsync(request.Search, cancellationToken);

    return new PaginatedList<PrivilegeDto>(items.ToList(), totalCount, request.PageNumber, request.PageSize);
  }
}
