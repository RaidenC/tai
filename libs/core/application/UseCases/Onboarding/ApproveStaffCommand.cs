using System;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using MediatR;
using Tai.Portal.Core.Application.Exceptions;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Domain.Entities;

namespace Tai.Portal.Core.Application.UseCases.Onboarding;

public record ApproveStaffCommand(string TargetUserId, string ApprovedByAdminId) : IRequest;

public class ApproveStaffCommandValidator : AbstractValidator<ApproveStaffCommand> {
  public ApproveStaffCommandValidator() {
    RuleFor(x => x.TargetUserId).NotEmpty();
    RuleFor(x => x.ApprovedByAdminId).NotEmpty();
    RuleFor(x => x).Must(x => x.TargetUserId != x.ApprovedByAdminId)
      .WithMessage("Users cannot approve their own accounts.");
  }
}

public class ApproveStaffCommandHandler : IRequestHandler<ApproveStaffCommand> {
  private readonly IIdentityService _identityService;

  public ApproveStaffCommandHandler(IIdentityService identityService) {
    _identityService = identityService;
  }

  public async Task Handle(ApproveStaffCommand request, CancellationToken cancellationToken) {
    var user = await _identityService.GetUserByIdAsync(request.TargetUserId, cancellationToken);

    if (user == null) {
      throw new UserNotFoundException(request.TargetUserId);
    }

    // Execute the domain state transition
    user.ApproveAccount(request.ApprovedByAdminId);

    var success = await _identityService.UpdateUserAsync(user, cancellationToken);

    if (!success) {
      throw new IdentityValidationException("Failed to update user during approval.");
    }
  }
}
