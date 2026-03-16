using System;
using System.Collections.Generic;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Domain.Interfaces;
using Tai.Portal.Core.Domain.Enums;
using Tai.Portal.Core.Domain.Events;

namespace Tai.Portal.Core.Domain.Entities;

/// <summary>
/// Represents a system-wide permission or privilege in the TAI Portal.
/// Privileges are organized hierarchically using dot notation (e.g., Portal.Users.Read).
/// </summary>
public class Privilege : IAuditableEntity, IHasDomainEvents {
  /// <summary>
  /// The unique surrogate primary key.
  /// </summary>
  public PrivilegeId Id { get; private set; }

  /// <summary>
  /// The hierarchical business identifier (e.g., 'Portal.Users.Read').
  /// Immutable once created to maintain system integrity.
  /// </summary>
  public string Name { get; private set; }

  /// <summary>
  /// Human-readable explanation of what this privilege grants.
  /// </summary>
  public string Description { get; private set; }

  /// <summary>
  /// The logical application or module this privilege belongs to (e.g., 'Portal', 'DocViewer').
  /// </summary>
  public string Module { get; private set; }

  /// <summary>
  /// The security risk level which determines if Step-Up Authentication is required.
  /// </summary>
  public RiskLevel RiskLevel { get; private set; }

  /// <summary>
  /// Configuration for Just-In-Time (JIT) elevation policy.
  /// </summary>
  public JitSettings JitSettings { get; private set; }

  /// <summary>
  /// Indicates if the privilege is active and assignable.
  /// </summary>
  public bool IsActive { get; private set; }

  /// <summary>
  /// Defines which boundaries (Global, Tenant, Self) are applicable to this privilege.
  /// </summary>
  public List<PrivilegeScope> SupportedScopes { get; private set; } = new();

  // IAuditableEntity implementation
  public DateTimeOffset CreatedAt { get; set; }
  public string? CreatedBy { get; set; }
  public DateTimeOffset? LastModifiedAt { get; set; }
  public string? LastModifiedBy { get; set; }

  /// <summary>
  /// Optimistic Concurrency Token (ETag).
  /// Maps to the PostgreSQL system column 'xmin'.
  /// </summary>
  public uint RowVersion { get; private set; }

  private readonly List<IDomainEvent> _domainEvents = new();
  public IReadOnlyCollection<IDomainEvent> DomainEvents => _domainEvents.AsReadOnly();

  // Parameterless constructor for EF Core materialization.
  protected Privilege() {
    Id = default!;
    Name = string.Empty;
    Description = string.Empty;
    Module = string.Empty;
    JitSettings = default!;
  }

  /// <summary>
  /// Domain Constructor enforcing all required invariants.
  /// </summary>
  public Privilege(string name, string description, string module, RiskLevel riskLevel, JitSettings jitSettings) {
    ValidateNameFormat(name);

    if (string.IsNullOrWhiteSpace(description)) throw new ArgumentException("Description cannot be empty.", nameof(description));
    if (string.IsNullOrWhiteSpace(module)) throw new ArgumentException("Module cannot be empty.", nameof(module));

    Id = new PrivilegeId(Guid.NewGuid());
    Name = name.Trim();
    Description = description.Trim();
    Module = module.Trim();
    RiskLevel = riskLevel;
    JitSettings = jitSettings;
    IsActive = true;
  }

  private static void ValidateNameFormat(string name) {
    if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Name cannot be empty.", nameof(name));

    // Dot Notation validation (e.g., App.Resource.Action)
    if (!name.Contains('.') ||
        name.StartsWith('.') ||
        name.EndsWith('.') ||
        name.Contains("..") ||
        name.Contains(' ')) {
      throw new ArgumentException("Privilege name must follow a hierarchical dot notation (e.g., App.Resource.Action).", nameof(name));
    }
  }

  public void SetRiskLevel(RiskLevel newRiskLevel) {
    if (RiskLevel != newRiskLevel) {
      RiskLevel = newRiskLevel;
      _domainEvents.Add(new PrivilegeModifiedEvent(Id, Name));
    }
  }

  public void Deactivate() {
    if (IsActive) {
      IsActive = false;
      _domainEvents.Add(new PrivilegeModifiedEvent(Id, Name));
    }
  }

  public void Activate() {
    if (!IsActive) {
      IsActive = true;
      _domainEvents.Add(new PrivilegeModifiedEvent(Id, Name));
    }
  }

  public void AddSupportedScope(PrivilegeScope scope) {
    if (!SupportedScopes.Contains(scope)) {
      SupportedScopes.Add(scope);
      _domainEvents.Add(new PrivilegeModifiedEvent(Id, Name));
    }
  }

  public void RemoveSupportedScope(PrivilegeScope scope) {
    if (SupportedScopes.Remove(scope)) {
      _domainEvents.Add(new PrivilegeModifiedEvent(Id, Name));
    }
  }

  public void UpdateMetadata(string description, JitSettings jitSettings) {
    if (string.IsNullOrWhiteSpace(description)) throw new ArgumentException("Description cannot be empty.", nameof(description));
    Description = description.Trim();
    JitSettings = jitSettings;
    _domainEvents.Add(new PrivilegeModifiedEvent(Id, Name));
  }

  public void ClearDomainEvents() {
    _domainEvents.Clear();
  }
}
