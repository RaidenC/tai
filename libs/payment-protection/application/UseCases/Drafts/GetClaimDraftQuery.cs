using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Tai.PaymentProtection.Application.Interfaces;

namespace Tai.PaymentProtection.Application.UseCases.Drafts;

public record GetClaimDraftQuery(string UserId, string ClaimId) : IRequest<ClaimDraftResult?>;

public record ClaimDraftResult(
  string UserId,
  string ClaimId,
  byte[] EncryptedPayload,
  DateTimeOffset ExpiresAt
);

public class GetClaimDraftQueryHandler : IRequestHandler<GetClaimDraftQuery, ClaimDraftResult?> {
  private readonly IClaimDraftStore _store;

  public GetClaimDraftQueryHandler(IClaimDraftStore store) {
    _store = store;
  }

  public async Task<ClaimDraftResult?> Handle(GetClaimDraftQuery request, CancellationToken cancellationToken) {
    var draft = await _store.GetAsync(request.UserId, request.ClaimId, cancellationToken);

    if (draft == null || draft.IsExpired(DateTimeOffset.UtcNow)) {
      return null;
    }

    return new ClaimDraftResult(draft.UserId, draft.ClaimId, draft.EncryptedPayload, draft.ExpiresAt);
  }
}
