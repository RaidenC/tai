using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Domain.Interfaces;
using System;

namespace Tai.Portal.Core.Domain.Entities;

/// <summary>
/// Represents a Tenant in the system (e.g., a specific Bank or Credit Union).
/// </summary>
public class Tenant : IMultiTenantEntity, IAuditableEntity {
  /// <summary>
  /// The primary database key.
  /// </summary>
  public TenantId Id { get; private set; }

  public DateTimeOffset CreatedAt { get; set; }
  public string? CreatedBy { get; set; }
  public DateTimeOffset? LastModifiedAt { get; set; }
  public string? LastModifiedBy { get; set; }

  /// <summary>
  /// Implementation of IMultiTenantEntity. 
  /// For a Tenant entity itself, the "owner" is its own ID.
  /// </summary>
  public TenantId AssociatedTenantId => Id;

  /// <summary>
  /// The official name of the tenant organization.
  /// </summary>
  public string Name { get; private set; }

  /// <summary>
  /// The primary hostname (e.g., 'acme.localhost') used to identify this tenant.
  /// 
  /// JUNIOR RATIONALE: We use the web request's URL to figure out which bank 
  /// the user is trying to access. This property is the "Key" we look for.
  /// </summary>
  public string TenantHostname { get; private set; }

  /// <summary>
  /// Configuration setting to enforce Multi-Factor Authentication for all users of this tenant.
  /// </summary>
  public bool EnforceMfa { get; private set; }

  // Parameterless constructor for EF Core
  private Tenant() {
    Id = default!;
    Name = string.Empty;
    TenantHostname = string.Empty;
  }

  public Tenant(TenantId id, string name, string tenantHostname) {
    if (string.IsNullOrWhiteSpace(name)) {
      throw new ArgumentException("Tenant name cannot be empty.", nameof(name));
    }
    if (string.IsNullOrWhiteSpace(tenantHostname)) {
      throw new ArgumentException("Hostname cannot be empty.", nameof(tenantHostname));
    }

    Id = id;
    Name = name;
    TenantHostname = tenantHostname.Trim().ToLowerInvariant();
    EnforceMfa = false; // Default value
  }

  public void SetMfaPolicy(bool enforce) {
    EnforceMfa = enforce;
  }
}
