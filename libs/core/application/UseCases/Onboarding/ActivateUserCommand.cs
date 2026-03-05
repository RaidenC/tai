using System;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using MediatR;
using Tai.Portal.Core.Application.Exceptions;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Domain.Entities;

namespace Tai.Portal.Core.Application.UseCases.Onboarding;

public record ActivateUserCommand(string UserId, string OtpCode) : IRequest;

public class ActivateUserCommandValidator : AbstractValidator<ActivateUserCommand> {
  public ActivateUserCommandValidator() {
    RuleFor(x => x.UserId).NotEmpty();
    RuleFor(x => x.OtpCode).NotEmpty().Length(6);
  }
}

public class ActivateUserCommandHandler : IRequestHandler<ActivateUserCommand> {
  private readonly IIdentityService _identityService;

  public ActivateUserCommandHandler(IIdentityService identityService) {
    _identityService = identityService;
  }

  public async Task Handle(ActivateUserCommand request, CancellationToken cancellationToken) {
    var user = await _identityService.GetUserByIdAsync(request.UserId, cancellationToken);

    if (user == null) {
      throw new UserNotFoundException(request.UserId);
    }

    // In a real application, we would verify the OTP code here against a cache or database.
    // For this mock implementation, any 6-digit code provided to the command is considered valid.
    if (request.OtpCode.Length != 6) {
      throw new InvalidOperationException("Invalid OTP Code format.");
    }

    // Execute the domain state transition
    user.ActivateAccount();

    var success = await _identityService.UpdateUserAsync(user, cancellationToken);

    if (!success) {
      throw new IdentityValidationException("Failed to update user during activation.");
    }
  }
}
