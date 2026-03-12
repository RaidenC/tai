using System;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using MediatR;
using Tai.Portal.Core.Application.Exceptions;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.ValueObjects;

namespace Tai.Portal.Core.Application.UseCases.Onboarding;

public record ApproveStaffCommand(string TargetUserId, string ApprovedByAdminId, uint? ExpectedRowVersion = null) : IRequest;

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
  private readonly IOtpService _otpService;

  public ApproveStaffCommandHandler(IIdentityService identityService, IOtpService otpService) {
    _identityService = identityService;
    _otpService = otpService;
  }

  public async Task Handle(ApproveStaffCommand request, CancellationToken cancellationToken) {
    var user = await _identityService.GetUserByIdAsync(request.TargetUserId, cancellationToken);

    if (user == null) {
      throw new UserNotFoundException(request.TargetUserId);
    }

    // Manual check for concurrency before domain logic (Fast fail)
    if (request.ExpectedRowVersion.HasValue && user.RowVersion != request.ExpectedRowVersion.Value) {
      throw new ConcurrencyException("The user record was modified by another process.");
    }

    // Execute the domain state transition
    user.Approve((TenantAdminId)request.ApprovedByAdminId);

    var success = await _identityService.UpdateUserAsync(user, cancellationToken);

    if (!success) {
      throw new IdentityValidationException("Failed to update user during approval.");
    }

    // User is now approved and in PendingVerification state. 
    // Trigger the simulated activation to deliver their setup code.
    await _otpService.GenerateAndStoreOtpAsync(user.Id, cancellationToken);
  }
}
