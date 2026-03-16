using System;

namespace Tai.Portal.Core.Domain.ValueObjects;

/// <summary>
/// A strongly-typed, immutable identifier for a Privilege.
/// </summary>
/// <param name="Value">The underlying Guid.</param>
public readonly record struct PrivilegeId(Guid Value) {
  public static explicit operator PrivilegeId(Guid value) => new(value);
  public static implicit operator Guid(PrivilegeId id) => id.Value;
  public override string ToString() => Value.ToString();
}
