using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using MediatR;
using Tai.PaymentProtection.Application.Interfaces;

namespace Tai.PaymentProtection.Application.UseCases.Drafts;

public record DeleteClaimDraftCommand(string UserId, string ClaimId) : IRequest;

public class DeleteClaimDraftCommandValidator : AbstractValidator<DeleteClaimDraftCommand> {
  public DeleteClaimDraftCommandValidator() {
    RuleFor(x => x.UserId).NotEmpty();
    RuleFor(x => x.ClaimId).NotEmpty();
  }
}

public class DeleteClaimDraftCommandHandler : IRequestHandler<DeleteClaimDraftCommand> {
  private readonly IClaimDraftStore _store;

  public DeleteClaimDraftCommandHandler(IClaimDraftStore store) {
    _store = store;
  }

  public Task Handle(DeleteClaimDraftCommand request, CancellationToken cancellationToken) {
    return _store.DeleteAsync(request.UserId, request.ClaimId, cancellationToken);
  }
}
