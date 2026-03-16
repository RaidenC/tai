using Tai.Portal.Core.Domain.Interfaces;
using Tai.Portal.Core.Domain.ValueObjects;

namespace Tai.Portal.Core.Domain.Events;

/// <summary>
/// Domain event published when a privilege's metadata or risk level is modified.
/// </summary>
public record PrivilegeModifiedEvent(PrivilegeId PrivilegeId, string Name) : IDomainEvent;
