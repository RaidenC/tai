using Tai.Portal.Core.Domain.ValueObjects;

namespace Tai.Portal.Core.Domain.Interfaces;

/// <summary>
/// This interface is a "Marker." By applying it to an entity, we are telling 
/// the system: "This data is private to a tenant and must be isolated."
/// 
/// JUNIOR RATIONALE: We use this interface to find all tenant-specific classes 
/// using Reflection. It's like putting a "Private" sticker on a folder so the 
/// system knows to lock it down automatically.
/// </summary>
public interface IMultiTenantEntity {
  /// <summary>
  /// The unique identifier of the tenant that owns this data.
  /// </summary>
  TenantId AssociatedTenantId { get; }
}
