using System;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using MediatR;
using Tai.Portal.Core.Application.Interfaces;

namespace Tai.Portal.Core.Application.UseCases.Users;

public record UpdateUserCommand(
  string Id,
  string FirstName,
  string LastName,
  string Email,
  uint RowVersion) : IRequest<bool>;

public class UpdateUserCommandValidator : AbstractValidator<UpdateUserCommand> {
  public UpdateUserCommandValidator() {
    RuleFor(x => x.Id).NotEmpty();
    RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
    RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
    RuleFor(x => x.Email).NotEmpty().EmailAddress();
  }
}

public class UpdateUserCommandHandler : IRequestHandler<UpdateUserCommand, bool> {
  private readonly IIdentityService _identityService;

  public UpdateUserCommandHandler(IIdentityService identityService) {
    _identityService = identityService;
  }

  public async Task<bool> Handle(UpdateUserCommand request, CancellationToken cancellationToken) {
    var user = await _identityService.GetUserByIdAsync(request.Id, cancellationToken);
    if (user == null) {
      return false;
    }

    // Concurrency Check
    if (user.RowVersion != request.RowVersion) {
      throw new Exception("Concurrency conflict: The user has been modified by another process.");
    }

    user.FirstName = request.FirstName;
    user.LastName = request.LastName;
    user.Email = request.Email;
    user.UserName = request.Email; // Keep UserName in sync with Email

    return await _identityService.UpdateUserAsync(user, cancellationToken);
  }
}
