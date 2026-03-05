using System;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Identity;
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
  private readonly UserManager<ApplicationUser> _userManager;

  public ApproveStaffCommandHandler(UserManager<ApplicationUser> userManager) {
    _userManager = userManager;
  }

  public async Task Handle(ApproveStaffCommand request, CancellationToken cancellationToken) {
    var user = await _userManager.FindByIdAsync(request.TargetUserId);

    if (user == null) {
      throw new InvalidOperationException($"User with ID {request.TargetUserId} not found.");
    }

    // Execute the domain state transition
    user.ApproveAccount(request.ApprovedByAdminId);

    var result = await _userManager.UpdateAsync(user);

    if (!result.Succeeded) {
      var errors = string.Join(", ", System.Linq.Enumerable.Select(result.Errors, e => e.Description));
      throw new InvalidOperationException($"Failed to update user: {errors}");
    }
  }
}
