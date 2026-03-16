using MediatR;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Application.Models;
using Tai.Portal.Core.Domain.Enums;
using Tai.Portal.Core.Domain.ValueObjects;

namespace Tai.Portal.Core.Application.UseCases.Privileges;

public record UpdatePrivilegeCommand(
    Guid Id,
    string Description,
    RiskLevel RiskLevel,
    bool IsActive,
    JitSettings JitSettings,
    uint RowVersion) : IRequest<PrivilegeDto>;

public class UpdatePrivilegeCommandHandler : IRequestHandler<UpdatePrivilegeCommand, PrivilegeDto> {
  private readonly IPrivilegeService _privilegeService;

  public UpdatePrivilegeCommandHandler(IPrivilegeService privilegeService) {
    _privilegeService = privilegeService;
  }

  public async Task<PrivilegeDto> Handle(UpdatePrivilegeCommand request, CancellationToken cancellationToken) {
    return await _privilegeService.UpdatePrivilegeAsync(
      request.Id,
      request.Description,
      request.RiskLevel,
      request.IsActive,
      request.JitSettings,
      request.RowVersion,
      cancellationToken);
  }
}
