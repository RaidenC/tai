using System;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using MediatR;
using Tai.Portal.Core.Application.Exceptions;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.ValueObjects;

namespace Tai.Portal.Core.Application.UseCases.Users;

public record UpdateUserCommand(
  string Id,
  string Email,
  string FirstName,
  string LastName,
  uint? ExpectedRowVersion = null) : IRequest;

public class UpdateUserCommandValidator : AbstractValidator<UpdateUserCommand> {
  public UpdateUserCommandValidator() {
    RuleFor(x => x.Id).NotEmpty();
    RuleFor(x => x.Email).NotEmpty().EmailAddress();
    RuleFor(x => x.FirstName).NotEmpty();
    RuleFor(x => x.LastName).NotEmpty();
  }
}

public class UpdateUserCommandHandler : IRequestHandler<UpdateUserCommand> {
  private readonly IIdentityService _identityService;

  public UpdateUserCommandHandler(IIdentityService identityService) {
    _identityService = identityService;
  }

  public async Task Handle(UpdateUserCommand request, CancellationToken cancellationToken) {
    var user = await _identityService.GetUserByIdAsync(request.Id, cancellationToken);

    if (user == null) {
      throw new UserNotFoundException(request.Id);
    }

    // We perform a manual concurrency check BEFORE 
    // applying changes. This allows us to "Fail Fast" and avoid unnecessary 
    // database operations if the user is already out of sync.
    if (request.ExpectedRowVersion.HasValue && user.RowVersion != request.ExpectedRowVersion.Value) {
      throw new ConcurrencyException("The user record was modified by another process.");
    }

    user.Email = request.Email;
    user.UserName = request.Email;
    user.FirstName = request.FirstName;
    user.LastName = request.LastName;

    var success = await _identityService.UpdateUserAsync(user, cancellationToken);

    if (!success) {
      throw new IdentityValidationException("Failed to update user.");
    }
  }
}
