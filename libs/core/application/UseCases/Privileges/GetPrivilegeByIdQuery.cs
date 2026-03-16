using MediatR;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Application.Models;

namespace Tai.Portal.Core.Application.UseCases.Privileges;

public record GetPrivilegeByIdQuery(Guid Id) : IRequest<PrivilegeDto?>;

public class GetPrivilegeByIdQueryHandler : IRequestHandler<GetPrivilegeByIdQuery, PrivilegeDto?> {
  private readonly IPrivilegeService _privilegeService;

  public GetPrivilegeByIdQueryHandler(IPrivilegeService privilegeService) {
    _privilegeService = privilegeService;
  }

  public async Task<PrivilegeDto?> Handle(GetPrivilegeByIdQuery request, CancellationToken cancellationToken) {
    return await _privilegeService.GetPrivilegeByIdAsync(request.Id, cancellationToken);
  }
}
