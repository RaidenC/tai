using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Tai.PaymentProtection.Application.Interfaces;
using Tai.PaymentProtection.Domain.Entities;

namespace Tai.PaymentProtection.Infrastructure.Persistence;

public class EfClaimDraftStore : IClaimDraftStore {
  private readonly PaymentProtectionDbContext _ctx;

  public EfClaimDraftStore(PaymentProtectionDbContext ctx) {
    _ctx = ctx;
  }

  public Task<ClaimDraft?> GetAsync(string userId, string claimId, CancellationToken cancellationToken = default) {
    return _ctx.ClaimDrafts
      .AsTracking()
      .FirstOrDefaultAsync(d => d.UserId == userId && d.ClaimId == claimId, cancellationToken);
  }

  public async Task SaveAsync(ClaimDraft draft, CancellationToken cancellationToken = default) {
    var existing = await _ctx.ClaimDrafts
      .AsTracking()
      .FirstOrDefaultAsync(d => d.UserId == draft.UserId && d.ClaimId == draft.ClaimId, cancellationToken);

    if (existing == null) {
      _ctx.ClaimDrafts.Add(draft);
    } else {
      existing.Update(draft.EncryptedPayload, draft.ExpiresAt);
    }

    await _ctx.SaveChangesAsync(cancellationToken);
  }

  public async Task DeleteAsync(string userId, string claimId, CancellationToken cancellationToken = default) {
    var draft = await _ctx.ClaimDrafts
      .FirstOrDefaultAsync(d => d.UserId == userId && d.ClaimId == claimId, cancellationToken);

    if (draft != null) {
      _ctx.ClaimDrafts.Remove(draft);
      await _ctx.SaveChangesAsync(cancellationToken);
    }
  }
}
