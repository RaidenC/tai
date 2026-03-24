using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Application.Models;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.Enums;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Infrastructure.Persistence;

namespace Tai.Portal.Core.Infrastructure.Persistence.Services;

public class PrivilegeService : IPrivilegeService {
  private readonly PortalDbContext _context;
  private readonly IMemoryCache _cache;
  private const string PrivilegesCacheKey = "Privileges_All";

  public PrivilegeService(PortalDbContext context, IMemoryCache cache) {
    _context = context;
    _cache = cache;
  }

  public async Task<IEnumerable<PrivilegeDto>> GetPrivilegesAsync(
      int skip,
      int take,
      string? search,
      string[]? modules,
      CancellationToken cancellationToken) {

    if (skip == 0 && take == 10 && string.IsNullOrWhiteSpace(search) && (modules == null || modules.Length == 0)) {
      return await _cache.GetOrCreateAsync(PrivilegesCacheKey, async entry => {
        entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10);
        return await FetchPrivilegesFromDb(0, 10, null, null, cancellationToken);
      }) ?? Enumerable.Empty<PrivilegeDto>();
    }

    return await FetchPrivilegesFromDb(skip, take, search, modules, cancellationToken);
  }

  private async Task<IEnumerable<PrivilegeDto>> FetchPrivilegesFromDb(int skip, int take, string? search, string[]? modules, CancellationToken cancellationToken) {
    var query = _context.Privileges.AsNoTracking();

    if (!string.IsNullOrWhiteSpace(search)) {
      query = query.Where(p => p.Name.Contains(search) || p.Description.Contains(search));
    }

    if (modules != null && modules.Length > 0) {
      query = query.Where(p => modules.Contains(p.Module));
    }

    return await query
        .OrderBy(p => p.Name)
        .Skip(skip)
        .Take(take)
        .Select(p => new PrivilegeDto(
            p.Id.Value,
            p.Name,
            p.Description,
            p.Module,
            p.RiskLevel,
            p.IsActive,
            p.RowVersion,
            p.JitSettings))
        .ToListAsync(cancellationToken);
  }

  public async Task<int> CountPrivilegesAsync(string? search, string[]? modules, CancellationToken cancellationToken) {
    var query = _context.Privileges.AsNoTracking();

    if (!string.IsNullOrWhiteSpace(search)) {
      query = query.Where(p => p.Name.Contains(search) || p.Description.Contains(search));
    }

    if (modules != null && modules.Length > 0) {
      query = query.Where(p => modules.Contains(p.Module));
    }

    return await query.CountAsync(cancellationToken);
  }

  public async Task<PrivilegeDto?> GetPrivilegeByIdAsync(Guid id, CancellationToken cancellationToken) {
    var cacheKey = $"Privilege_{id}";
    return await _cache.GetOrCreateAsync(cacheKey, async entry => {
      entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10);
      var p = await _context.Privileges
          .AsNoTracking()
          .FirstOrDefaultAsync(x => x.Id == new PrivilegeId(id), cancellationToken);

      if (p == null) return null;

      return new PrivilegeDto(
          p.Id.Value,
          p.Name,
          p.Description,
          p.Module,
          p.RiskLevel,
          p.IsActive,
          p.RowVersion,
          p.JitSettings);
    });
  }

  public async Task<PrivilegeDto> CreatePrivilegeAsync(
      string name,
      string description,
      string module,
      RiskLevel riskLevel,
      JitSettings jitSettings,
      CancellationToken cancellationToken) {
    if (await _context.Privileges.AnyAsync(p => p.Name == name, cancellationToken)) {
      throw new InvalidOperationException($"Privilege with name '{name}' already exists.");
    }

    var privilege = new Privilege(name, description, module, riskLevel, jitSettings);

    _context.Privileges.Add(privilege);
    await _context.SaveChangesAsync(cancellationToken);

    InvalidateCache(privilege.Id.Value);

    return new PrivilegeDto(
        privilege.Id.Value,
        privilege.Name,
        privilege.Description,
        privilege.Module,
        privilege.RiskLevel,
        privilege.IsActive,
        privilege.RowVersion,
        privilege.JitSettings);
  }

  public async Task<PrivilegeDto> UpdatePrivilegeAsync(
      Guid id,
      string description,
      RiskLevel riskLevel,
      bool isActive,
      JitSettings jitSettings,
      uint rowVersion,
      CancellationToken cancellationToken) {
    var privilege = await _context.Privileges
        .FirstOrDefaultAsync(p => p.Id == new PrivilegeId(id), cancellationToken);

    if (privilege == null) throw new KeyNotFoundException($"Privilege with ID {id} not found.");

    if (privilege.RowVersion != rowVersion) {
      throw new DbUpdateConcurrencyException("Concurrency conflict detected.");
    }

    privilege.UpdateMetadata(description, jitSettings);
    privilege.SetRiskLevel(riskLevel);
    if (isActive) privilege.Activate(); else privilege.Deactivate();

    await _context.SaveChangesAsync(cancellationToken);

    // Force a reload to get the latest database-generated RowVersion (xmin)
    await _context.Entry(privilege).ReloadAsync(cancellationToken);

    InvalidateCache(id);

    return new PrivilegeDto(
        privilege.Id.Value,
        privilege.Name,
        privilege.Description,
        privilege.Module,
        privilege.RiskLevel,
        privilege.IsActive,
        privilege.RowVersion,
        privilege.JitSettings);
  }

  private void InvalidateCache(Guid id) {
    _cache.Remove(PrivilegesCacheKey);
    _cache.Remove($"Privilege_{id}");
  }
}
