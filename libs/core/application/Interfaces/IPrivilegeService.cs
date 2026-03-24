using Tai.Portal.Core.Application.Models;
using Tai.Portal.Core.Domain.Enums;
using Tai.Portal.Core.Domain.ValueObjects;

namespace Tai.Portal.Core.Application.Interfaces;

public interface IPrivilegeService {
  Task<IEnumerable<PrivilegeDto>> GetPrivilegesAsync(
      int skip,
      int take,
      string? search,
      string[]? modules,
      CancellationToken cancellationToken);

  Task<int> CountPrivilegesAsync(
      string? search,
      string[]? modules,
      CancellationToken cancellationToken);

  Task<PrivilegeDto?> GetPrivilegeByIdAsync(Guid id, CancellationToken cancellationToken);

  Task<PrivilegeDto> CreatePrivilegeAsync(
      string name,
      string description,
      string module,
      RiskLevel riskLevel,
      JitSettings jitSettings,
      CancellationToken cancellationToken);

  Task<PrivilegeDto> UpdatePrivilegeAsync(
      Guid id,
      string description,
      RiskLevel riskLevel,
      bool isActive,
      JitSettings jitSettings,
      uint rowVersion,
      CancellationToken cancellationToken);
}
