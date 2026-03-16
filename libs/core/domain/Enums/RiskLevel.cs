namespace Tai.Portal.Core.Domain.Enums;

/// <summary>
/// Categorizes the potential security impact of a privilege.
/// Used to trigger Step-Up Authentication or specific approval workflows.
/// </summary>
public enum RiskLevel {
  Low,
  Medium,
  High,
  Critical
}
