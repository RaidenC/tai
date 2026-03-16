using Tai.Portal.Core.Domain.Enums;
using Tai.Portal.Core.Domain.ValueObjects;

namespace Tai.Portal.Core.Application.Models;

public record PrivilegeDto(
    Guid Id,
    string Name,
    string Description,
    string Module,
    RiskLevel RiskLevel,
    bool IsActive,
    uint RowVersion,
    JitSettings JitSettings);
