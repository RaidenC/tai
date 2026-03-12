using System;
using System.Collections.Generic;
using Microsoft.AspNetCore.Identity;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Domain.Interfaces;
using Tai.Portal.Core.Domain.Enums;
using Tai.Portal.Core.Domain.Events;

namespace Tai.Portal.Core.Domain.Entities;

/// <summary>
/// Represents a user within the multi-tenant TAI Portal system.
/// Inherits from IdentityUser to leverage .NET Core Identity infrastructure
/// while extending it with domain-specific concerns.
/// </summary>
public class ApplicationUser : IdentityUser, IMultiTenantEntity, IHasDomainEvents, IAuditableEntity {
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

  public DateTimeOffset CreatedAt { get; set; }
  public string? CreatedBy { get; set; }
  public DateTimeOffset? LastModifiedAt { get; set; }
  public string? LastModifiedBy { get; set; }

  public string? FirstName { get; set; }
  public string? LastName { get; set; }

  /// <summary>
  /// An example of using the field keyword for data sanitization on a standard property.
  /// </summary>
  public override string? Email {
    get;
    // C# 14: Direct access to backing field allows concise normalization logic.
    set => field = value?.Trim().ToLowerInvariant();
  }

  public UserStatus Status { get; private set; } = UserStatus.Created;

  public TenantAdminId? ApprovedBy { get; private set; }

  /// <summary>
  /// Optimistic Concurrency Token (ETag).
  /// Maps to the PostgreSQL system column 'xmin'.
  /// </summary>
  public uint RowVersion { get; set; }

  private readonly List<IDomainEvent> _domainEvents = new();
  public IReadOnlyCollection<IDomainEvent> DomainEvents => _domainEvents.AsReadOnly();

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
    Id = Guid.NewGuid().ToString(); // Ensure ID is generated for unit tests that need it before saving.
  }

  public void StartCustomerOnboarding() {
    if (Status != UserStatus.Created) {
      throw new InvalidOperationException($"Cannot start onboarding from state {Status}");
    }
    Status = UserStatus.PendingVerification;
    _domainEvents.Add(new UserRegisteredEvent(Id));
  }

  public void StartStaffOnboarding() {
    if (Status != UserStatus.Created) {
      throw new InvalidOperationException($"Cannot start onboarding from state {Status}");
    }
    Status = UserStatus.PendingApproval;
    _domainEvents.Add(new UserRegisteredEvent(Id));
  }

  public void Approve(TenantAdminId approvedBy) {
    if (Status != UserStatus.PendingApproval) {
      throw new InvalidOperationException($"User account cannot be approved in state {Status}");
    }
    if (Id == (string)approvedBy) {
      throw new InvalidOperationException("Users cannot approve their own accounts.");
    }
    Status = UserStatus.PendingVerification;
    ApprovedBy = approvedBy;
    _domainEvents.Add(new UserApprovedEvent(Id, approvedBy));
  }

  public void ActivateAccount() {
    if (Status != UserStatus.PendingVerification) {
      throw new InvalidOperationException($"User account cannot be activated in state {Status}");
    }
    Status = UserStatus.Active;
  }

  public bool CanLogin() {
    return Status == UserStatus.Active;
  }

  public void ClearDomainEvents() {
    _domainEvents.Clear();
  }
}
