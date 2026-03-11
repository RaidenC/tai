using System;

namespace Tai.Portal.Core.Domain.ValueObjects;

/// <summary>
/// A strongly-typed, immutable identifier for a Tenant Administrator.
/// Wraps the underlying string ID from the Identity system.
/// Implemented as a readonly record struct to ensure value semantics and 
/// stack allocation efficiency in the NativeAOT environment.
/// </summary>
public readonly record struct TenantAdminId {
  // The underlying primitive value.
  public string Value { get; }

  // Primary constructor.
  public TenantAdminId(string value) {
    if (string.IsNullOrWhiteSpace(value)) {
      throw new ArgumentException("A valid TenantAdminId is required.", nameof(value));
    }
    Value = value;
  }

  // Explicit conversion avoids accidental assignment of raw strings, 
  // enforcing type safety in the Domain layer.
  public static explicit operator TenantAdminId(string value) => new(value);
  public static implicit operator string(TenantAdminId id) => id.Value;

  public override string ToString() => Value;
}
