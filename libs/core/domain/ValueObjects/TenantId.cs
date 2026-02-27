using System;

namespace Tai.Portal.Core.Domain.ValueObjects;

/// <summary>
/// A strongly-typed, immutable identifier for a Tenant.
/// Implemented as a readonly record struct to ensure value semantics and 
/// stack allocation efficiency in the NativeAOT environment.
/// </summary>
public readonly record struct TenantId {
  // The underlying primitive value.
  public Guid Value { get; }

  // Primary constructor.
  public TenantId(Guid value) {
    Value = value;
  }

  // Explicit conversion avoids accidental assignment of raw Guids, 
  // enforcing type safety in the Domain layer.
  public static explicit operator TenantId(Guid value) => new(value);
  public static implicit operator Guid(TenantId id) => id.Value;

  public override string ToString() => Value.ToString();
}
