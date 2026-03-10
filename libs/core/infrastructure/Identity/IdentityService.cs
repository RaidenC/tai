using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.Enums;
using Tai.Portal.Core.Domain.ValueObjects;

namespace Tai.Portal.Core.Infrastructure.Identity;

public class IdentityService : IIdentityService {
  private readonly UserManager<ApplicationUser> _userManager;

  public IdentityService(UserManager<ApplicationUser> userManager) {
    _userManager = userManager;
  }

  public async Task<(bool Success, string[] Errors)> CreateUserAsync(ApplicationUser user, string password, CancellationToken cancellationToken = default) {
    var result = await _userManager.CreateAsync(user, password);
    return (result.Succeeded, result.Errors.Select(e => e.Description).ToArray());
  }

  public async Task<ApplicationUser?> GetUserByIdAsync(string userId, CancellationToken cancellationToken = default) {
    // UserManager doesn't natively take a cancellation token for FindByIdAsync, 
    // but we can query the Users IQueryable directly if we need strict token adherence.
    // For now, using the built-in method is sufficient.
    return await _userManager.FindByIdAsync(userId);
  }

  public async Task<bool> UpdateUserAsync(ApplicationUser user, CancellationToken cancellationToken = default) {
    var result = await _userManager.UpdateAsync(user);
    return result.Succeeded;
  }

  public async Task<IEnumerable<ApplicationUser>> GetUsersByStatusAndTenantAsync(
      UserStatus status,
      TenantId tenantId,
      int skip,
      int take,
      CancellationToken cancellationToken = default) {

    // Because UserManager.Users is an IQueryable, we can safely apply LINQ
    // operations here which will be translated to SQL by EF Core.
    return await _userManager.Users
      .Where(u => u.Status == status && u.TenantId == tenantId)
      .OrderByDescending(u => u.UserName)
      .Skip(skip)
      .Take(take)
      .ToListAsync(cancellationToken);
  }

  public async Task<IEnumerable<ApplicationUser>> GetUsersByTenantAsync(TenantId tenantId, int skip, int take, CancellationToken cancellationToken = default) {
    return await _userManager.Users
      .IgnoreQueryFilters()
      .Where(u => u.TenantId == tenantId)
      .OrderBy(u => u.UserName)
      .Skip(skip)
      .Take(take)
      .ToListAsync(cancellationToken);
  }

  public async Task<int> CountUsersByTenantAsync(TenantId tenantId, CancellationToken cancellationToken = default) {
    return await _userManager.Users
      .IgnoreQueryFilters()
      .Where(u => u.TenantId == tenantId)
      .CountAsync(cancellationToken);
  }
}
