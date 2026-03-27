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
  private readonly Persistence.PortalDbContext _context;

  public IdentityService(UserManager<ApplicationUser> userManager, Persistence.PortalDbContext context) {
    _userManager = userManager;
    _context = context;
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

  public async Task<IEnumerable<ApplicationUser>> GetUsersByTenantAsync(
      TenantId tenantId,
      int skip,
      int take,
      string? sortColumn = null,
      string? sortDirection = null,
      string? search = null,
      CancellationToken cancellationToken = default) {

    var query = _userManager.Users
      .IgnoreQueryFilters()
      .Where(u => u.TenantId == tenantId);

    if (!string.IsNullOrWhiteSpace(search)) {
      query = query.Where(u =>
        (u.Email != null && u.Email.Contains(search)) ||
        (u.FirstName != null && u.FirstName.Contains(search)) ||
        (u.LastName != null && u.LastName.Contains(search)) ||
        (u.UserName != null && u.UserName.Contains(search)));
    }

    // Apply Sorting
    query = (sortColumn?.ToLower(), sortDirection?.ToLower()) switch {
      ("name", "desc") => query.OrderByDescending(u => u.FirstName).ThenByDescending(u => u.LastName),
      ("name", "asc") => query.OrderBy(u => u.FirstName).ThenBy(u => u.LastName),
      ("email", "desc") => query.OrderByDescending(u => u.Email),
      ("email", "asc") => query.OrderBy(u => u.Email),
      _ => query.OrderBy(u => u.UserName)
    };

    return await query
      .Skip(skip)
      .Take(take)
      .ToListAsync(cancellationToken);
  }

  public async Task<int> CountUsersByTenantAsync(TenantId tenantId, string? search = null, CancellationToken cancellationToken = default) {
    var query = _userManager.Users
      .IgnoreQueryFilters()
      .Where(u => u.TenantId == tenantId);

    if (!string.IsNullOrWhiteSpace(search)) {
      query = query.Where(u =>
        (u.Email != null && u.Email.Contains(search)) ||
        (u.FirstName != null && u.FirstName.Contains(search)) ||
        (u.LastName != null && u.LastName.Contains(search)) ||
        (u.UserName != null && u.UserName.Contains(search)));
    }

    return await query.CountAsync(cancellationToken);
  }

  public async Task<IEnumerable<PrivilegeId>> GetUserPrivilegesAsync(string userId, CancellationToken cancellationToken = default) {
    return await _context.UserPrivileges
      .Where(up => up.UserId == userId)
      .Select(up => up.PrivilegeId)
      .ToListAsync(cancellationToken);
  }

  public async Task<bool> UpdateUserPrivilegesAsync(string userId, IEnumerable<PrivilegeId> privilegeIds, CancellationToken cancellationToken = default) {
    var currentPrivileges = await _context.UserPrivileges
      .Where(up => up.UserId == userId)
      .ToListAsync(cancellationToken);

    _context.UserPrivileges.RemoveRange(currentPrivileges);

    foreach (var privilegeId in privilegeIds) {
      _context.UserPrivileges.Add(new UserPrivilege(userId, privilegeId));
    }

    await _context.SaveChangesAsync(cancellationToken);
    return true;
  }
}
