using System;
using Microsoft.AspNetCore.Identity;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Domain.Interfaces;

namespace Tai.Portal.Core.Domain.Entities;

/// <summary>
/// Represents a user within the multi-tenant TAI Portal system.
/// Inherits from IdentityUser to leverage .NET Core Identity infrastructure
/// while extending it with domain-specific concerns.
/// </summary>
public class ApplicationUser : IdentityUser, IMultiTenantEntity {
  /// <summary>
  /// The unique identifier of the tenant this user belongs to.
  /// 
  /// FEATURES:
  /// 1. Init-only: Ensures immutability after creation.
  /// 2. C# 14 'field' keyword: Allows validation logic without a manual backing field.
  /// 3. Strict Invariant: Ensures a user is never created without a valid TenantId.
  /// </summary>
  public TenantId TenantId {
    get;
    // C# 14 Syntax: 'field' refers to the compiler-synthesized backing store.
    init => field = (value.Value == Guid.Empty)
      ? throw new ArgumentException("A valid TenantId is required.", nameof(value))
      : value;
  }

  /// <summary>
  /// Implementation of IMultiTenantEntity.
  /// </summary>
  public TenantId AssociatedTenantId => TenantId;

  /// <summary>
  /// An example of using the field keyword for data sanitization on a standard property.
  /// </summary>
  public override string? Email {
    get;
    // C# 14: Direct access to backing field allows concise normalization logic.
    set => field = value?.Trim().ToLowerInvariant();
  }

  // NativeAOT & EF Core Requirement:
  // EF Core requires a parameterless constructor for materialization.
  // We keep it protected to prevent invalid domain state instantiation by consumer code.
  protected ApplicationUser() { }

  /// <summary>
  /// Domain Constructor ensuring all required invariants are met.
  /// </summary>
  public ApplicationUser(string userName, TenantId tenantId) : base(userName) {
    // The init accessor logic will run when we assign the property here.
    TenantId = tenantId;
  }
}
