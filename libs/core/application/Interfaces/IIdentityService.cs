using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.Enums;
using Tai.Portal.Core.Domain.ValueObjects;

namespace Tai.Portal.Core.Application.Interfaces;

public interface IIdentityService {
  Task<(bool Success, string[] Errors)> CreateUserAsync(ApplicationUser user, string password, CancellationToken cancellationToken = default);
  Task<ApplicationUser?> GetUserByIdAsync(string userId, CancellationToken cancellationToken = default);
  Task<bool> UpdateUserAsync(ApplicationUser user, CancellationToken cancellationToken = default);
  Task<IEnumerable<ApplicationUser>> GetUsersByStatusAndTenantAsync(UserStatus status, TenantId tenantId, int skip, int take, CancellationToken cancellationToken = default);
  Task<IEnumerable<ApplicationUser>> GetUsersByTenantAsync(TenantId tenantId, int skip, int take, string? sortColumn = null, string? sortDirection = null, string? search = null, CancellationToken cancellationToken = default);
  Task<int> CountUsersByTenantAsync(TenantId tenantId, string? search = null, CancellationToken cancellationToken = default);
  Task<IEnumerable<PrivilegeId>> GetUserPrivilegesAsync(string userId, CancellationToken cancellationToken = default);
  Task<bool> UpdateUserPrivilegesAsync(string userId, IEnumerable<PrivilegeId> privilegeIds, CancellationToken cancellationToken = default);
}
