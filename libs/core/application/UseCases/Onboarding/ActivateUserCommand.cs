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
  private readonly IOtpService _otpService;

  public ActivateUserCommandHandler(IIdentityService identityService, IOtpService otpService) {
    _identityService = identityService;
    _otpService = otpService;
  }

  public async Task Handle(ActivateUserCommand request, CancellationToken cancellationToken) {
    var user = await _identityService.GetUserByIdAsync(request.UserId, cancellationToken);

    if (user == null) {
      throw new UserNotFoundException(request.UserId);
    }

    var isValidOtp = await _otpService.ValidateOtpAsync(request.UserId, request.OtpCode, cancellationToken);

    if (!isValidOtp) {
      throw new IdentityValidationException("Invalid or expired OTP Code.");
    }

    // Execute the domain state transition
    user.ActivateAccount();

    var success = await _identityService.UpdateUserAsync(user, cancellationToken);

    if (!success) {
      throw new IdentityValidationException("Failed to update user during activation.");
    }
  }
}
