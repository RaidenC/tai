using System;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using MediatR;
using Tai.PaymentProtection.Application.Events;
using Tai.PaymentProtection.Application.Interfaces;
using Tai.PaymentProtection.Domain.Entities;

namespace Tai.PaymentProtection.Application.UseCases.Drafts;

public record SaveClaimDraftCommand(
  string UserId,
  string ClaimId,
  byte[] EncryptedPayload,
  TimeSpan Ttl
) : IRequest;

public class SaveClaimDraftCommandValidator : AbstractValidator<SaveClaimDraftCommand> {
  public SaveClaimDraftCommandValidator() {
    RuleFor(x => x.UserId).NotEmpty();
    RuleFor(x => x.ClaimId).NotEmpty();
    RuleFor(x => x.EncryptedPayload).NotEmpty();
    RuleFor(x => x.Ttl).Must(t => t > TimeSpan.Zero).WithMessage("Ttl must be positive.");
  }
}

public class SaveClaimDraftCommandHandler : IRequestHandler<SaveClaimDraftCommand> {
  private readonly IClaimDraftStore _store;
  private readonly IPublisher _publisher;

  public SaveClaimDraftCommandHandler(IClaimDraftStore store, IPublisher publisher) {
    _store = store;
    _publisher = publisher;
  }

  public async Task Handle(SaveClaimDraftCommand request, CancellationToken cancellationToken) {
    var expiresAt = DateTimeOffset.UtcNow.Add(request.Ttl);
    var existing = await _store.GetAsync(request.UserId, request.ClaimId, cancellationToken);

    ClaimDraft draft;
    if (existing == null) {
      draft = new ClaimDraft(request.UserId, request.ClaimId, request.EncryptedPayload, expiresAt);
    } else {
      existing.Update(request.EncryptedPayload, expiresAt);
      draft = existing;
    }

    await _store.SaveAsync(draft, cancellationToken);
    await _publisher.Publish(new ClaimDraftSavedEvent(request.UserId, request.ClaimId, DateTimeOffset.UtcNow), cancellationToken);
  }
}
