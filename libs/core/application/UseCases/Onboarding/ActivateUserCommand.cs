using System;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Identity;
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
  private readonly UserManager<ApplicationUser> _userManager;

  public ActivateUserCommandHandler(UserManager<ApplicationUser> userManager) {
    _userManager = userManager;
  }

  public async Task Handle(ActivateUserCommand request, CancellationToken cancellationToken) {
    var user = await _userManager.FindByIdAsync(request.UserId);

    if (user == null) {
      throw new InvalidOperationException($"User with ID {request.UserId} not found.");
    }

    // In a real application, we would verify the OTP code here against a cache or database.
    // For this mock implementation, any 6-digit code provided to the command is considered valid.
    if (request.OtpCode.Length != 6) {
      throw new InvalidOperationException("Invalid OTP Code format.");
    }

    // Execute the domain state transition
    user.ActivateAccount();

    var result = await _userManager.UpdateAsync(user);

    if (!result.Succeeded) {
      var errors = string.Join(", ", System.Linq.Enumerable.Select(result.Errors, e => e.Description));
      throw new InvalidOperationException($"Failed to update user: {errors}");
    }
  }
}
