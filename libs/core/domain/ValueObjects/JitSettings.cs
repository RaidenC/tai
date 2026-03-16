using System;

namespace Tai.Portal.Core.Domain.ValueObjects;

/// <summary>
/// Defines the Just-In-Time (JIT) elevation policy for a privilege.
/// </summary>
/// <param name="MaxElevationDuration">The maximum time a user can hold the elevated privilege.</param>
/// <param name="RequiresApproval">Whether a second-pair-of-eyes approval is required.</param>
/// <param name="RequiresJustification">Whether the user must provide a reason or ticket reference.</param>
public record struct JitSettings(
  TimeSpan? MaxElevationDuration,
  bool RequiresApproval,
  bool RequiresJustification
);
