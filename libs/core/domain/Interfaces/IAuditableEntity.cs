using System;

namespace Tai.Portal.Core.Domain.Interfaces;

/// <summary>
/// Interface for entities that require basic change tracking (Created/Modified).
/// </summary>
public interface IAuditableEntity {
  DateTimeOffset CreatedAt { get; set; }
  string? CreatedBy { get; set; }
  DateTimeOffset? LastModifiedAt { get; set; }
  string? LastModifiedBy { get; set; }
}
