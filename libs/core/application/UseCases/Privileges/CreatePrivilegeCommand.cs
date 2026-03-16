using MediatR;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Application.Models;
using Tai.Portal.Core.Domain.Enums;
using Tai.Portal.Core.Domain.ValueObjects;

namespace Tai.Portal.Core.Application.UseCases.Privileges;

public record CreatePrivilegeCommand(
    string Name,
    string Description,
    string Module,
    RiskLevel RiskLevel,
    JitSettings JitSettings) : IRequest<PrivilegeDto>;

public class CreatePrivilegeCommandHandler : IRequestHandler<CreatePrivilegeCommand, PrivilegeDto> {
  private readonly IPrivilegeService _privilegeService;

  public CreatePrivilegeCommandHandler(IPrivilegeService privilegeService) {
    _privilegeService = privilegeService;
  }

  public async Task<PrivilegeDto> Handle(CreatePrivilegeCommand request, CancellationToken cancellationToken) {
    return await _privilegeService.CreatePrivilegeAsync(
      request.Name,
      request.Description,
      request.Module,
      request.RiskLevel,
      request.JitSettings,
      cancellationToken);
  }
}
