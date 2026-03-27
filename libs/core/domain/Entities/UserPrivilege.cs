using System;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Domain.Interfaces;

namespace Tai.Portal.Core.Domain.Entities;

/// <summary>
/// Join entity for the many-to-many relationship between ApplicationUser and Privilege.
/// </summary>
public class UserPrivilege : IAuditableEntity {
  public string UserId { get; private set; }
  public PrivilegeId PrivilegeId { get; private set; }

  // IAuditableEntity implementation
  public DateTimeOffset CreatedAt { get; set; }
  public string? CreatedBy { get; set; }
  public DateTimeOffset? LastModifiedAt { get; set; }
  public string? LastModifiedBy { get; set; }

  // Required for EF Core
  protected UserPrivilege() {
    UserId = string.Empty;
    PrivilegeId = default!;
  }

  public UserPrivilege(string userId, PrivilegeId privilegeId) {
    if (string.IsNullOrWhiteSpace(userId)) throw new ArgumentException("UserId is required.", nameof(userId));

    UserId = userId;
    PrivilegeId = privilegeId;
  }
}
