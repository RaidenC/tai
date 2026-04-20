using System;
using System.Threading;
using System.Threading.Tasks;
using Tai.PaymentProtection.Domain.Entities;

namespace Tai.PaymentProtection.Application.Interfaces;

/// <summary>
/// Persistence port for claim drafts. Implemented by EfClaimDraftStore
/// (Postgres / EF Core) in the infrastructure layer; an in-memory fake is
/// used in handler unit tests.
/// </summary>
public interface IClaimDraftStore {
  Task<ClaimDraft?> GetAsync(string userId, string claimId, CancellationToken cancellationToken = default);
  Task SaveAsync(ClaimDraft draft, CancellationToken cancellationToken = default);
  Task DeleteAsync(string userId, string claimId, CancellationToken cancellationToken = default);
}
